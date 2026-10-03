import { RawVector, RawRotation } from "./raw";
// scratchBuffer should be as big as the biggest index Rust tries to set on it.
export const scratchBuffer = new Float32Array(16);
/**
 * A 2D vector.
 */
export class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}
export class VectorOps {
    static new(x, y) {
        return new Vector2(x, y);
    }
    static zeros() {
        return VectorOps.new(0.0, 0.0);
    }
    static fromBuffer(buffer, target) {
        if (!buffer)
            return null;
        target !== null && target !== void 0 ? target : (target = VectorOps.zeros());
        target.x = buffer[0];
        target.y = buffer[1];
        return target;
    }
    // FIXME: type ram: RawVector?
    static fromRaw(raw) {
        if (!raw)
            return null;
        let res = VectorOps.new(raw.x, raw.y);
        raw.free();
        return res;
    }
    static intoRaw(v) {
        return new RawVector(v.x, v.y);
    }
    static copy(out, input) {
        out.x = input.x;
        out.y = input.y;
    }
}
export class RotationOps {
    static identity() {
        return 0.0;
    }
    static fromRaw(raw) {
        if (!raw)
            return null;
        let res = raw.angle;
        raw.free();
        return res;
    }
    static intoRaw(angle) {
        return RawRotation.fromAngle(angle);
    }
}
// #endif
//# sourceMappingURL=math.js.map