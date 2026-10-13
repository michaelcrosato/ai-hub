/*
 * AtlasTravel - canonical-metre travel along an authored polyline.
 * Pure UMD: no engine, browser clock, timers, DOM, or rendering dependency.
 * update(seconds) consumes caller-supplied active real time. The caller owns
 * monotonic wall time and interruption handling. Terrain is sampled at the
 * start of each movement substep, never longer than MAX_STEP_SECONDS.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.AtlasTravel = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_STEP_SECONDS = 0.025;

  function finiteNumber(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(name + ' must be a finite number.');
    }
    return value;
  }

  function nonnegativeNumber(value, name) {
    finiteNumber(value, name);
    if (value < 0) throw new RangeError(name + ' must be zero or greater.');
    return value;
  }

  function validSpeed(value) {
    finiteNumber(value, 'speedKmh');
    if (value <= 0 || value > 100) {
      throw new RangeError('speedKmh must be greater than 0 and at most 100.');
    }
    return value;
  }

  function compileRoute(input) {
    if (!Array.isArray(input) || input.length < 2) {
      throw new TypeError('points must be an array of at least two finite {x, y} points.');
    }
    const points = input.map(function (point, index) {
      if (!point || typeof point !== 'object') {
        throw new TypeError('points[' + index + '] must contain finite x and y values.');
      }
      return Object.freeze({
        x: finiteNumber(point.x, 'points[' + index + '].x'),
        y: finiteNumber(point.y, 'points[' + index + '].y')
      });
    });
    const segments = [];
    let length = 0;
    let correction = 0;
    for (let index = 1; index < points.length; index++) {
      const from = points[index - 1];
      const to = points[index];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      if (!Number.isFinite(distance)) {
        throw new RangeError('Route segment length must be finite.');
      }
      // Repeated vertices are legal. They have no travel time or direction.
      if (distance === 0) continue;
      const adjusted = distance - correction;
      const nextLength = length + adjusted;
      if (!Number.isFinite(nextLength) || nextLength <= length) {
        throw new RangeError('Route length exceeds supported numeric precision.');
      }
      correction = (nextLength - length) - adjusted;
      segments.push(Object.freeze({
        from: from, to: to, dx: dx, dy: dy, length: distance,
        startM: length, endM: nextLength, facing: Math.atan2(dy, dx)
      }));
      length = nextLength;
    }
    if (!(length > 0)) throw new RangeError('Route must have a positive length.');
    return { points: Object.freeze(points), segments: segments, length: length };
  }

  function routeLength(points) {
    return compileRoute(points).length;
  }

  function positionOnRoute(route, distanceM) {
    const distance = Math.min(route.length, distanceM);
    let segment = route.segments[route.segments.length - 1];
    if (distance < route.length) {
      // A vertex uses the next nonzero segment's forward direction.
      let low = 0;
      let high = route.segments.length - 1;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (distance >= route.segments[middle].endM) low = middle + 1;
        else high = middle;
      }
      segment = route.segments[low];
    }
    const fraction = distance >= route.length ? 1 : Math.max(0, Math.min(1,
      (distance - segment.startM) / segment.length));
    return {
      x: fraction === 1 ? segment.to.x : segment.from.x + segment.dx * fraction,
      y: fraction === 1 ? segment.to.y : segment.from.y + segment.dy * fraction,
      facing: segment.facing,
      distanceM: distance,
      remainingM: Math.max(0, route.length - distance),
      totalDistanceM: route.length
    };
  }

  function positionAtDistance(points, distanceM) {
    nonnegativeNumber(distanceM, 'distanceM');
    return positionOnRoute(compileRoute(points), distanceM);
  }

  class RouteRun {
    constructor(options) {
      if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('RouteRun requires an options object.');
      }
      const route = compileRoute(options.points);
      const speed = options.speedKmh === undefined ? 40 : validSpeed(options.speedKmh);
      if (options.terrainFactor !== undefined && typeof options.terrainFactor !== 'function') {
        throw new TypeError('terrainFactor must be a function when supplied.');
      }
      this._route = route;
      this._speedKmh = speed;
      this._terrainFactor = options.terrainFactor || function () { return 1; };
      this._segmentIndex = 0;
      this._segmentOffsetM = 0;
      this._offsetCorrection = 0;
      this._distanceM = 0;
      this._activeSeconds = 0;
      this._timeCorrection = 0;
      this._actualSpeedKmh = 0;
      this._paused = false;
      this._complete = false;
      this._uniformMps = undefined;
      this._mixedSpeed = false;
      const first = route.segments[0];
      this._x = first.from.x;
      this._y = first.from.y;
      this._facing = first.facing;
    }

    get points() { return this._route.points; }
    get totalDistanceM() { return this._route.length; }
    get speedKmh() { return this._speedKmh; }
    set speedKmh(value) { this._speedKmh = validSpeed(value); }
    get paused() { return this._paused; }

    state() {
      return {
        x: this._x,
        y: this._y,
        facing: this._facing,
        distanceM: this._distanceM,
        activeSeconds: this._activeSeconds,
        complete: this._complete,
        remainingM: Math.max(0, this._route.length - this._distanceM),
        actualSpeedKmh: this._paused || this._complete ? 0 : this._actualSpeedKmh,
        paused: this._paused,
        speedKmh: this._speedKmh,
        totalDistanceM: this._route.length
      };
    }

    pause() {
      this._paused = true;
      this._actualSpeedKmh = 0;
      return this.state();
    }

    resume() {
      this._paused = false;
      this._actualSpeedKmh = 0;
      return this.state();
    }

    _addTime(seconds) {
      const adjusted = seconds - this._timeCorrection;
      const next = this._activeSeconds + adjusted;
      if (!Number.isFinite(next)) throw new RangeError('Accumulated active time must be finite.');
      this._timeCorrection = (next - this._activeSeconds) - adjusted;
      this._activeSeconds = next;
    }

    _recordRate(metresPerSecond) {
      if (this._uniformMps === undefined) this._uniformMps = metresPerSecond;
      else if (this._uniformMps !== metresPerSecond) this._mixedSpeed = true;
    }

    _reachVertex(segment) {
      this._x = segment.to.x;
      this._y = segment.to.y;
      this._distanceM = segment.endM;
      this._facing = segment.facing;
      this._segmentIndex++;
      this._segmentOffsetM = 0;
      this._offsetCorrection = 0;
      if (this._segmentIndex === this._route.segments.length) {
        this._complete = true;
        this._distanceM = this._route.length;
      } else {
        this._facing = this._route.segments[this._segmentIndex].facing;
      }
    }

    update(realSeconds) {
      nonnegativeNumber(realSeconds, 'realSeconds');
      if (realSeconds === 0 || this._paused || this._complete) return this.state();

      const beforeDistance = this._distanceM;
      const beforeTime = this._activeSeconds;
      let consumed = 0;
      let consumedCorrection = 0;

      while (consumed < realSeconds && !this._complete) {
        const stepSeconds = Math.min(MAX_STEP_SECONDS, realSeconds - consumed);
        const segment = this._route.segments[this._segmentIndex];
        const toVertexM = Math.max(0, segment.length - this._segmentOffsetM);
        const roundingM = 32 * Number.EPSILON * segment.length;
        // Advance an already-reached vertex before sampling its surface. A
        // zero terrain factor at the destination cannot prevent completion.
        if (toVertexM <= roundingM) {
          this._reachVertex(segment);
          continue;
        }
        const factor = this._terrainFactor(this._x, this._y);
        finiteNumber(factor, 'terrainFactor result');
        if (factor < 0 || factor > 1) {
          throw new RangeError('terrainFactor result must be between 0 and 1.');
        }
        const metresPerSecond = this._speedKmh / 3.6 * factor;
        this._recordRate(metresPerSecond);
        const toVertexSeconds = metresPerSecond > 0 ? toVertexM / metresPerSecond : Infinity;
        const reachesVertex = toVertexSeconds <= stepSeconds ||
          (metresPerSecond > 0 && toVertexM - metresPerSecond * stepSeconds <= roundingM);
        const usedSeconds = reachesVertex ? Math.min(stepSeconds, toVertexSeconds) : stepSeconds;

        if (reachesVertex) {
          // Reaching a corner never turns the remaining time into a diagonal.
          this._reachVertex(segment);
        } else {
          const movedM = metresPerSecond * usedSeconds;
          const adjusted = movedM - this._offsetCorrection;
          const nextOffset = this._segmentOffsetM + adjusted;
          this._offsetCorrection = (nextOffset - this._segmentOffsetM) - adjusted;
          this._segmentOffsetM = Math.min(segment.length, nextOffset);
          const fraction = this._segmentOffsetM / segment.length;
          this._x = segment.from.x + segment.dx * fraction;
          this._y = segment.from.y + segment.dy * fraction;
          this._distanceM = segment.startM + this._segmentOffsetM;
          this._facing = segment.facing;
        }

        // A zero terrain factor spends active time while adding zero metres.
        // An explicit pause is handled above and spends no active time.
        this._addTime(usedSeconds);
        const adjustedTime = usedSeconds - consumedCorrection;
        const nextConsumed = consumed + adjustedTime;
        consumedCorrection = (nextConsumed - consumed) - adjustedTime;
        consumed = nextConsumed;
      }

      if (this._complete && !this._mixedSpeed && this._uniformMps > 0) {
        // Constant effective speed has an analytic endpoint time. Retaining it
        // avoids accumulated binary rounding, including 100 m / 40 km/h = 9 s.
        this._activeSeconds = this._route.length / this._uniformMps;
        this._timeCorrection = 0;
      }
      const elapsed = this._activeSeconds - beforeTime;
      this._actualSpeedKmh = elapsed > 0 ?
        Math.max(0, (this._distanceM - beforeDistance) / elapsed * 3.6) : 0;
      return this.state();
    }
  }

  function formatDuration(seconds) {
    nonnegativeNumber(seconds, 'seconds');
    const whole = Math.floor(seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor(whole / 60) % 60;
    const remainder = whole % 60;
    return String(hours).padStart(2, '0') + ':' +
      String(minutes).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
  }

  return Object.freeze({ RouteRun, routeLength, positionAtDistance, formatDuration, MAX_STEP_SECONDS });
});
