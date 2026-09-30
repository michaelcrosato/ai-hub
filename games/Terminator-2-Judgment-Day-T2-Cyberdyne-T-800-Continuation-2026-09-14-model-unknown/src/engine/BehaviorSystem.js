/**
 * Component behaviors. A behavior can offer prompt()/interact() and step or render hooks.
 * This episode uses the spawn marker and its own support station ('board-car', registered
 * by the episode); the starter's unused editor components were removed with the editor.
 */
export class Behaviors {
    schemas;
    factories = new Map();
    constructor(schemas) {
        this.schemas = schemas;
    }
    register(type, validate, factory) {
        if (this.factories.has(type))
            throw new Error(`Behavior already registered: ${type}`);
        this.schemas.register(type, validate);
        this.factories.set(type, factory);
    }
    builtin(type, factory) { this.factories.set(type, factory); }
    create(type, e, data, ctx) {
        const factory = this.factories.get(type);
        if (!factory)
            throw new Error(`No behavior factory for ${type}.`);
        return factory(e, data, ctx);
    }
}
export function registerBuiltins(registry) {
    registry.builtin('spawn', () => ({}));
}
