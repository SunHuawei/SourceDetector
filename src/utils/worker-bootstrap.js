// AMD loader
self.define = (function () {
    var modules = {};
    var defines = {};

    function exec(name) {
        if (modules[name]) return modules[name];
        var define = defines[name];
        if (!define) throw new Error('Module ' + name + ' not found');
        var module = { exports: {} };
        var deps = define.deps.map(d => d === 'require' ? req : d === 'exports' ? module.exports : exec(d));
        define.factory.apply(null, deps);
        modules[name] = module.exports;
        return module.exports;
    }

    function req(name) {
        return exec(name);
    }

    var define = function (name, deps, factory) {
        defines[name] = { deps, factory };
    };
    define.amd = true;
    return define;
})();