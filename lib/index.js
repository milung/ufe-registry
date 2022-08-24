"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installUfeRegistry = exports.getUfeRegistryAsync = void 0;
const stencil_router_v2_1 = require("stencil-router-v2");
/**  use this function to reliable retrieve instance of
 * the UfeRegistry interface */
const getUfeRegistryAsync = () => UfeRegistryImpl.instanceAsync(false);
exports.getUfeRegistryAsync = getUfeRegistryAsync;
/**  Do not use directly! Used internally by ufe-controller main page, to create a
 *   instance of UfeRegistry and bootstrap the micro-frontend environment
 **/
function installUfeRegistry() {
    window.addEventListener("load", (_) => __awaiter(this, void 0, void 0, function* () {
        if (window.ufeRegistry)
            return;
        yield UfeRegistryImpl.loadComponents();
        window.ufeRegistry = yield UfeRegistryImpl.instanceAsync(true);
        yield window.ufeRegistry.createAppShell();
    }));
}
exports.installUfeRegistry = installUfeRegistry;
// implementation of the interface
class UfeRegistryImpl {
    constructor() {
        this.router = (0, stencil_router_v2_1.createRouter)();
        this._basePathValue = null;
    }
    ;
    get userId() {
        var _a, _b;
        return (_b = (_a = UfeRegistryImpl.webConfig) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
    }
    href(href, router = this.router) {
        return {
            href,
            onClick: (ev) => {
                if ((ev === null || ev === void 0 ? void 0 : ev.metaKey) || (ev === null || ev === void 0 ? void 0 : ev.ctrlKey)) {
                    return;
                }
                if ((ev === null || ev === void 0 ? void 0 : ev.which) == 2 || (ev === null || ev === void 0 ? void 0 : ev.button) == 1) {
                    return;
                }
                ev === null || ev === void 0 ? void 0 : ev.preventDefault();
                router === null || router === void 0 ? void 0 : router.push(href);
            },
        };
    }
    ;
    get basePath() {
        if (!this._basePathValue) {
            this._basePathValue = new URL(document.baseURI).pathname || "/";
            if (!this._basePathValue.endsWith('/')) {
                this._basePathValue + '/';
            }
        }
        return this._basePathValue;
    }
    rebasePath(path) {
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        return this._basePathValue + path;
    }
    static loadComponents() {
        return __awaiter(this, void 0, void 0, function* () {
            if (UfeRegistryImpl.webConfig != null) {
                return UfeRegistryImpl.webConfig;
            }
            else {
                const impl = new UfeRegistryImpl();
                let response = yield fetch(`${impl.basePath}fe-config`);
                if (response.status == 404) {
                    UfeRegistryImpl.webConfig = null;
                    return;
                }
                UfeRegistryImpl.webConfig = yield response.json();
                let preloads = UfeRegistryImpl.webConfig != null ? UfeRegistryImpl.webConfig.preload : [];
                yield impl.preloadDependenciesAsync(preloads);
            }
        });
    }
    static instanceAsync(nowait = false) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _) => __awaiter(this, void 0, void 0, function* () {
                while (!nowait && !(window.ufeRegistry)) {
                    yield new Promise(resolve => setTimeout(resolve, 250));
                }
                resolve(new UfeRegistryImpl());
            }));
        });
    }
    navigableApps(selector = {}) {
        var _a, _b;
        return this
            .matchSelector(selector, (_b = (_a = UfeRegistryImpl.webConfig) === null || _a === void 0 ? void 0 : _a.apps) !== null && _b !== void 0 ? _b : [])
            .sort((a, b) => b.priority - a.priority)
            .map(_ => {
            _.isActive = location.pathname.startsWith(this.rebasePath(_.path));
            return _;
        });
    }
    contextElements(context, selector = {}) {
        var _a, _b;
        return this
            .matchSelector(selector, (_b = (_a = UfeRegistryImpl.webConfig) === null || _a === void 0 ? void 0 : _a.contexts) !== null && _b !== void 0 ? _b : [])
            .filter(_ => _.contextNames.includes(context));
    }
    elementHtmlText(app) {
        let content = `<${app.element}`;
        app.attributes.forEach(attribute => {
            content += ` ${attribute.name}="${attribute.value}"`;
        });
        content += `></${app.element}>`;
        return content;
    }
    preloadDependenciesAsync(modules) {
        return __awaiter(this, void 0, void 0, function* () {
            modules
                .filter(_ => { var _a; return (_a = _.styles) === null || _a === void 0 ? void 0 : _a.length; })
                .forEach(this.preloadStyles);
            const loads = [...new Set(modules
                    .filter(_ => { var _a; return (_a = _.load_url) === null || _a === void 0 ? void 0 : _a.length; })
                    .map(_ => _.load_url))]
                .map(_ => Promise.resolve().then(() => require(_)));
            yield Promise.all(loads).catch(reason => {
                console.error(`Some of the dependencies failed to load: ${reason}`);
            });
        });
    }
    preloadStyles(module) {
        var _a;
        (_a = module.styles) === null || _a === void 0 ? void 0 : _a.forEach(abs => {
            var head = document.getElementsByTagName('head')[0];
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = abs;
            link.media = 'all';
            head.appendChild(link);
        });
    }
    matchSelector(selector, elements) {
        if (elements === undefined || elements === null || elements === [])
            return [];
        const metas = document.getElementsByTagName('meta');
        let normalizedSelector;
        // normalize selector
        if (selector === undefined) {
            normalizedSelector = {};
        }
        else if (typeof selector === 'string') {
            normalizedSelector = this.splitSelectorString(selector);
        }
        else {
            normalizedSelector = Object.assign({}, selector);
        }
        // combine with page selector specifier
        for (let i = 0; i < metas.length; i++) {
            if (metas[i].getAttribute('name') === "ufe-selector") {
                const content = metas[i].getAttribute('content');
                if (content) {
                    selector = Object.assign(Object.assign({}, normalizedSelector), this.splitSelectorString(content));
                }
            }
        }
        // filter applications by selector
        return elements.filter(element => Object.keys(normalizedSelector)
            .every(labelName => element.labels &&
            normalizedSelector[labelName] === element.labels[labelName]));
    }
    ;
    splitSelectorString(selector) {
        return selector
            .split(/(\,|;)/)
            .map(_ => _.split('=', 2))
            .reduce((acc, keyValue) => {
            acc[keyValue[0]] = keyValue[1];
            return acc;
        }, {});
    }
    createAppShell() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const registry = yield UfeRegistryImpl.instanceAsync();
            const metas = document.getElementsByTagName('meta');
            var context = "";
            for (let i = 0; i < metas.length; i++) {
                if (metas[i].getAttribute('name') === "ufe-shell-context") {
                    context = (_a = metas[i].getAttribute('content')) !== null && _a !== void 0 ? _a : "";
                    break;
                }
            }
            const shell = registry.contextElements(context, {})[0] || {
                element: "ufe-default-shell",
                attributes: [],
                load_url: "",
                roles: ["*"]
            };
            yield registry.preloadDependenciesAsync([shell]);
            const element = document.createElement(shell.element);
            shell.attributes.forEach(attribute => element.setAttribute(attribute.name, attribute.value));
            document.body.appendChild(element);
        });
    }
}
UfeRegistryImpl.webConfig = null;
