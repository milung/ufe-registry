import { createRouter, Router } from "stencil-router-v2";

/**  Micro-Front-End Module specification */
export interface UfeModule {
    /** URL from which the module can be loaded */
    load_url: string, 
    /** List of URLs to CSS files to be loaded with the module */
    styles?: string[],
}
export interface UfeElement extends UfeModule {
    /** element tag that shall be placed into the page  */
    element: string,
    /** list of preconfigured attributes for the element 
     * when element tag is rendered */
    attributes: Array<{name: string, value: any}>,
    /** list of labels associated with the element.
     * Used to select the subset of elements from the list
     */
    labels?: {[name: string]: string},
    /** Roles of users that shall see this element */
    roles?: string[],
}

export interface UfeWebApp extends UfeElement{
    /** Title of the navigable micro application */
    title: string;
    /** Human readable description of the application */
    details: string;
    /** path/location on which this application is served. 
     * Used also to compute href references in application lists
     */
    path: string;
    /** used to sort application in the lists */
    priority: number;
    /** icon url for the application */
    icon?: string;
    /** set to true if the browser is navigated to this application */
    isActive: boolean;
}

export interface UfeContext extends UfeElement {
    /** list of context names in which this element shall be placed */
    contextNames: string[];
}

/** This configuration is provided by ufe-controller, 
 *  Do not use directly, instead use UfeRegistry interface
 */
interface UfeConfiguration {
    /** list of modules that shall be automatically preloaded
     * regardles of current active application
     */
    preload: UfeModule[];
    /** list of registered applications */
    apps: UfeWebApp[];
    /** list of context sensitive web components */
    contexts: UfeContext[];
    /** true if current user is anonymous */
    anonymous?: boolean;
    /** user idenityt as provided by the controller */
    user?: {
        id: string;
        name: string;
        roles: string;
    }
}

/** Primary API interface for accessing registered micro apps  */
export interface UfeRegistry {

    /** global stencil router for application routing. 
     * The application can use it as a base for the subrouting */
    router: Router;

    /** base path of the application shell, if served on server subpaths */
    basePath: string;

    /** rebases(prefixes) paths by taking into consideration the basePath */
    rebasePath( path: string): string

    /** helper function to provide elements with navigation functionality 
     * If the stopPropafation is set to true, then the propagation of the event 
     * is stopped - usefull if applied on the elements that has own onClick
     * event handler that is conflicting with href's navigation handler
    */
    href(href: string, router?: Router, stopPropagation?:boolean): {href: any; onClick: (ev: any) => void;};

    /** list of navigable web-components - aka micro applications */
    navigableApps(selector?: { [name: string]: string} ): UfeWebApp[] ;

    /** list of context specific web components */
    contextElements(context: string, selector?: { [name: string]: string}): UfeContext[] ;

    /** dynamically loads module dependnecies */
    preloadDependenciesAsync(elements: UfeModule[]): Promise<void>;

    /** renders registered web-component(element) into html text that
     * can be then put into DOM
     */
    elementHtmlText(element: UfeElement): string;

    /** retrieves information about user */
    get userId(): string|undefined;
}

/**  use this function to reliable retrieve instance of 
 * the UfeRegistry interface */
export const getUfeRegistryAsync = () => UfeRegistryImpl.instanceAsync(false);

/**  Do not use directly! Used internally by ufe-controller main page, to create a 
 *   instance of UfeRegistry and bootstrap the micro-frontend environment
 **/
export function installUfeRegistry() {
    window.addEventListener("load", async _ => {
        if((window as any).ufeRegistry) return;

        await UfeRegistryImpl.loadComponents();
        (window as any).ufeRegistry = await UfeRegistryImpl.instanceAsync(true)
        await (window as any).ufeRegistry.createAppShell();
    })
}

// implementation of the interface
class UfeRegistryImpl implements UfeRegistry{

    private constructor() {};

    private static webConfig: UfeConfiguration|null = null;

    public readonly router: Router = createRouter();

    get userId(): string|undefined {
       return  UfeRegistryImpl.webConfig?.user?.id;
    }

    public href(href: string, router = this.router, stopPropagating = false)  {
        return {
            href,
            onClick: (ev: any) => {
                if (ev?.metaKey || ev?.ctrlKey) {
                    return;
                }
                if (ev?.which == 2 || ev?.button == 1) {
                    return;
                }
                ev?.preventDefault();
                if(stopPropagating) {
                    ev?.stopPropagation(); 
                    ev?.stopImmediatePropagation();
                }
                router?.push(href);
            },
        };
    };

    private _basePathValue:string|null = null;

    public  get basePath() {
        if(! this._basePathValue ) {
            this._basePathValue = new URL(document.baseURI).pathname || "/";
            if(! this._basePathValue.endsWith('/')) { this._basePathValue + '/'}
        }
        return this._basePathValue;
    }

    public  rebasePath( path: string  ) {
        if (path.startsWith('/')) {
            path = path.slice(1)
        }
        return this._basePathValue + path
    }

    static async loadComponents() {
        if(UfeRegistryImpl.webConfig != null) {
            return UfeRegistryImpl.webConfig;
        }
        else {
            const impl = new UfeRegistryImpl();
            let response = await fetch(`${impl.basePath}fe-config`);
            if(response.status == 404) {
                UfeRegistryImpl.webConfig = null
                return;
            }
            UfeRegistryImpl.webConfig  = await response.json();
            let preloads = UfeRegistryImpl.webConfig != null ? UfeRegistryImpl.webConfig.preload : [];
            await impl.preloadDependenciesAsync(preloads)
        }
    }

    static async instanceAsync(nowait:boolean = false): Promise<UfeRegistry> {
        return new Promise(async ( resolve, _) => {
            while(!nowait && !((window as any).ufeRegistry) )
            {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            resolve(new UfeRegistryImpl());
        })
    }

    navigableApps(selector: { [name: string]: string} = {} ): UfeWebApp[]  {
        return this
            .matchSelector(selector, UfeRegistryImpl.webConfig?.apps ?? [])
            .sort( (a, b) => b.priority  - a.priority)
            .map( _ => {
                _.isActive = location.pathname.startsWith(this.rebasePath(_.path))
                return _
            });
    }

    contextElements(context: string, selector: { [name: string]: string} = {}): UfeContext[]  {
        return this
            .matchSelector(selector, UfeRegistryImpl.webConfig?.contexts ?? [])
            .filter(_ => _.contextNames.includes(context));
    }

    elementHtmlText(app: UfeElement): string {
        let content = `<${app.element}`;
        app.attributes.forEach(attribute => {
        content += ` ${attribute.name}="${attribute.value}"`;
        });
        content += `></${app.element}>`;
        return content;
    }

    async preloadDependenciesAsync(modules: UfeModule[]) {
        modules
            .filter( _ => _.styles?.length )
           .forEach( this.preloadStyles ); 

        const loads = [...new Set(modules
            .filter(_ => _.load_url?.length)
            .map(_ => _.load_url))]
            .map(_ => import(_) as Promise<{}>); 
        await Promise.all(loads).catch( reason => {
            console.error(`Some of the dependencies failed to load: ${reason}`);
        });
        
    }

    private preloadStyles(module: UfeModule) {
        module.styles
            ?.forEach( abs => {
                var head  = document.getElementsByTagName('head')[0];
                var link  = document.createElement('link');
                
                link.rel  = 'stylesheet';
                link.type = 'text/css';
                link.href = abs;
                link.media = 'all';
                head.appendChild(link);
            }) 
    }

    private matchSelector<T extends UfeElement>(selector: string | { [name: string]: string} | undefined, elements: T[]): T[]  {
        if( elements === undefined  || elements === null || elements === []) return [];
        const metas =  document.getElementsByTagName('meta');
        let normalizedSelector: { [name: string]: string};
        // normalize selector
        if(selector === undefined) {
            normalizedSelector = {};
        } else if (typeof selector === 'string') {
            normalizedSelector = this.splitSelectorString(selector);
        } else {
            normalizedSelector = {...selector};
        }
        // combine with page selector specifier
        for (let i = 0; i < metas.length; i++) {
            if (metas[i].getAttribute('name') === "ufe-selector") {
              const content =  metas[i].getAttribute('content');
              if(content) {
                  selector = { ...normalizedSelector, ...this.splitSelectorString(content)};
              }
            }
        }
        // filter applications by selector
        return elements.filter(element => 
            Object.keys(normalizedSelector)
                  .every( labelName => 
                    element.labels && 
                    normalizedSelector[labelName] === element.labels[labelName])); 
    };

    private splitSelectorString( selector: string) : { [label: string]: string } {
        return selector
                .split(/(\,|;)/)
                .map(_=> _.split('=', 2))
                .reduce( (acc: {[name: string]: string}, keyValue) => { 
                    acc[keyValue[0]] = keyValue[1]; return acc 
                }, {} );
    }

    async createAppShell() {
        const registry = await UfeRegistryImpl.instanceAsync();
        const metas =  document.getElementsByTagName('meta');
        var context: string = "";
        for (let i = 0; i < metas.length; i++) {
            if (metas[i].getAttribute('name') === "ufe-shell-context") {
              context =  metas[i].getAttribute('content') ?? "";
              break;
            }
          }
        const shell = registry.contextElements(context, {})[0] || {
            element: "ufe-default-shell",
            attributes: [],
            load_url: "",
            roles: ["*"]
        };
        await registry.preloadDependenciesAsync([shell]);

        const element = document.createElement(shell.element);
        shell.attributes.forEach( 
            attribute => element.setAttribute(
                attribute.name, attribute.value));
        
        document.body.appendChild(element);
    }
}

