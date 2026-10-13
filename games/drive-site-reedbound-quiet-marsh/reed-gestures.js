/* Reed Gestures: screen-space stroke matching. No runtime dependencies. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReedGestures = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var TAU = Math.PI * 2;
  var EPS = 1e-7;
  var MIN_SPAN = 24;
  var MIN_LENGTH = 28;

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function asPoint(value) {
    if (!value) return null;
    var x = Array.isArray(value) ? value[0] : value.x;
    var y = Array.isArray(value) ? value[1] : value.y;
    return typeof x === 'number' && typeof y === 'number' &&
      Number.isFinite(x) && Number.isFinite(y) ? { x: x, y: y } : null;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clean(points) {
    if (!Array.isArray(points)) return [];
    var result = [];
    for (var i = 0; i < points.length; i++) {
      var point = asPoint(points[i]);
      if (point && (!result.length || distance(point, result[result.length - 1]) > 0.5)) {
        result.push(point);
      }
    }
    return result;
  }

  function getBounds(points) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < points.length; i++) {
      minX = Math.min(minX, points[i].x);
      minY = Math.min(minY, points[i].y);
      maxX = Math.max(maxX, points[i].x);
      maxY = Math.max(maxY, points[i].y);
    }
    if (!points.length) minX = minY = maxX = maxY = 0;
    return { x: minX, y: minY, minX: minX, minY: minY, maxX: maxX, maxY: maxY,
      width: maxX - minX, height: maxY - minY };
  }

  function pathLength(points) {
    var length = 0;
    for (var i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
    return length;
  }

  // Equal distance samples prevent pointer event frequency from changing a result.
  function resample(points, length) {
    if (points.length < 2 || length < EPS) return points.slice();
    var count = Math.max(32, Math.min(96, Math.ceil(length / 4)));
    var step = length / (count - 1);
    var result = [points[0]];
    var edge = 1, startLength = 0;
    for (var i = 1; i < count - 1; i++) {
      var wanted = i * step;
      while (edge < points.length - 1 &&
        startLength + distance(points[edge - 1], points[edge]) < wanted) {
        startLength += distance(points[edge - 1], points[edge]);
        edge++;
      }
      var a = points[edge - 1], b = points[edge];
      var t = clamp((wanted - startLength) / Math.max(EPS, distance(a, b)), 0, 1);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    result.push(points[points.length - 1]);
    return result;
  }

  function segmentDistanceSquared(a, b, point) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var lengthSquared = dx * dx + dy * dy;
    var t = lengthSquared < EPS ? 0 : clamp(
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
    var px = a.x + t * dx - point.x, py = a.y + t * dy - point.y;
    return px * px + py * py;
  }

  function hitSegment(a, b, point, radius) {
    a = asPoint(a); b = asPoint(b); point = asPoint(point);
    radius = radius === undefined ? 0 : radius;
    if (!a || !b || !point || !Number.isFinite(radius) || radius < 0) return false;
    return segmentDistanceSquared(a, b, point) <= radius * radius + EPS;
  }

  function analyze(points) {
    var stroke = clean(points);
    var bounds = getBounds(stroke);
    var length = pathLength(stroke);
    var center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    var result = { kind: 'unknown', center: center,
      radius: Math.sqrt(bounds.width * bounds.height) / 2,
      bounds: bounds, length: length, quality: 0 };
    var span = Math.max(bounds.width, bounds.height);
    if (stroke.length < 2 || span < MIN_SPAN || length < MIN_LENGTH) return result;

    var sample = resample(stroke, length);
    var first = stroke[0], last = stroke[stroke.length - 1];
    var chord = distance(first, last);
    var efficiency = chord / length;

    if (chord >= MIN_SPAN && efficiency >= 0.78) {
      var deviationSquared = 0, maxDeviation = 0;
      // Distance to the infinite end-to-end line permits a small hooked end.
      for (var i = 0; i < sample.length; i++) {
        var deviation = Math.abs((last.x - first.x) * (first.y - sample[i].y) -
          (first.x - sample[i].x) * (last.y - first.y)) / chord;
        deviationSquared += deviation * deviation;
        maxDeviation = Math.max(maxDeviation, deviation);
      }
      var rms = Math.sqrt(deviationSquared / sample.length);
      if (rms <= Math.max(3.5, chord * 0.085) &&
        maxDeviation <= Math.max(6, chord * 0.17)) {
        result.kind = 'line';
        result.radius = 0;
        result.quality = clamp(1 - (1 - efficiency) * 1.5 - rms / chord * 3, 0, 1);
        return result;
      }
    }

    // A loop may be an ellipse and may have a small gap. It must travel around
    // its center once, without excessive reversals or an inward scribble.
    var minor = Math.min(bounds.width, bounds.height);
    if (stroke.length < 5 || minor < 24 || minor / span < 0.42 || chord / span > 0.52) return result;
    var rx = bounds.width / 2, ry = bounds.height / 2;
    var ellipsePerimeter = Math.PI * (3 * (rx + ry) -
      Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    var perimeterRatio = length / ellipsePerimeter;
    if (perimeterRatio < 0.70 || perimeterRatio > 1.38) return result;

    var angularTotal = 0, angularTravel = 0, radialError = 0, centerHits = 0;
    var previousAngle = 0;
    for (var j = 0; j < sample.length; j++) {
      var nx = (sample[j].x - center.x) / rx;
      var ny = (sample[j].y - center.y) / ry;
      var normalizedRadius = Math.hypot(nx, ny);
      radialError += (normalizedRadius - 1) * (normalizedRadius - 1);
      if (normalizedRadius < 0.48) centerHits++;
      var angle = Math.atan2(ny, nx);
      if (j > 0) {
        var delta = angle - previousAngle;
        while (delta > Math.PI) delta -= TAU;
        while (delta < -Math.PI) delta += TAU;
        angularTotal += delta;
        angularTravel += Math.abs(delta);
      }
      previousAngle = angle;
    }
    var turn = Math.abs(angularTotal);
    var reversals = angularTravel < EPS ? 1 : (angularTravel - turn) / angularTravel;
    var radialRms = Math.sqrt(radialError / sample.length);
    if (turn < 4.9 || turn > 7.7 || angularTravel > 8.4 || reversals > 0.20 ||
      radialRms > 0.25 || centerHits > sample.length * 0.04) return result;

    result.kind = 'circle';
    result.quality = clamp(1 - radialRms * 1.5 - reversals -
      chord / span * 0.3 - Math.abs(perimeterRatio - 1) * 0.2, 0, 1);
    return result;
  }

  function lineTouches(points, targetPoint, radius) {
    var stroke = clean(points), target = asPoint(targetPoint);
    radius = radius === undefined ? 0 : radius;
    if (!target || !Number.isFinite(radius) || radius < 0 || analyze(stroke).kind !== 'line') return false;
    for (var i = 1; i < stroke.length; i++) {
      if (segmentDistanceSquared(stroke[i - 1], stroke[i], target) <= radius * radius + EPS) return true;
    }
    return false;
  }

  // Positive margin expands the loop. Negative margin keeps a target clear of
  // its edge. The short gap in an accepted open loop is closed for this test.
  function loopContains(points, targetPoint, margin) {
    var stroke = clean(points), target = asPoint(targetPoint);
    margin = margin === undefined ? 0 : margin;
    if (!target || !Number.isFinite(margin) || analyze(stroke).kind !== 'circle') return false;
    var inside = false, closestSquared = Infinity;
    for (var i = 0, j = stroke.length - 1; i < stroke.length; j = i++) {
      var a = stroke[j], b = stroke[i];
      closestSquared = Math.min(closestSquared, segmentDistanceSquared(a, b, target));
      if ((a.y > target.y) !== (b.y > target.y) &&
        target.x < (b.x - a.x) * (target.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    if (margin < 0) return inside && closestSquared + EPS >= margin * margin;
    return inside || closestSquared <= margin * margin + EPS;
  }

  return Object.freeze({ analyze: analyze, hitSegment: hitSegment,
    lineTouches: lineTouches, loopContains: loopContains });
});
