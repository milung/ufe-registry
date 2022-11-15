import { createRouter, Router } from "stencil-router-v2";
import {SelectorExpression, SelectorParser } from "./parser"
import {  h } from '@stencil/core';

declare global {
    interface Window {
      ufeRegistry: UfeRegistry;
    }
}

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

/** if user is logged in and userinfo is proxied in the request headers to the 
 *  backed microfrontend controller then this information is made available
 */
interface UfeUserInfo {
    /** typically email */
    id: string 

    /** preferred name, user name, or email, depence on the system configuration */
    name: string

    /** string of groups or roles the user belongs to - depends on the system configuration */
    roles: string[]
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
    user?: UfeUserInfo
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
    navigableApps(selector?:  string ): UfeWebApp[] ;

    /** list of context specific web components */
    contextElements(context: string, selector?: string): UfeContext[] ;

    /** dynamically loads module dependnecies */
    preloadDependenciesAsync(elements: UfeModule[]): Promise<void>;

    /** renders registered web-component(element) into html text that
     * can be then put into DOM
     */
    elementHtmlText(element: UfeElement): string;

    /** Loads element dependencies and renders the JSX DOM element for the element. 
     *  Optional `extraAttributes` will be 
     *  applied to the element (or override the original attributes)
     */
    loadAndRenderElement(element: UfeElement, extraAttributes?: { [name: string]: any } ):any;

    /** retrieves information about user */
    get userId(): string|undefined;

    /** retrieves information about user */
    get userinfo(): UfeUserInfo|undefined;

    /** Filters list of element returning only elements that fits the selector.
     * Selector is expression consisting of terms 
     *  * equality: `label=value`, 
     *  * inequality: `label!=value`,
     *  * label existence: `label`
     *  * logical negation: `!expr` 
     *  * logical or:  `expr1 || expr2`
     *  * logical and: `expr1 && expr2`
     *  * block expression: "( expr )"
     *  
     * Example of more complex selector: 
     * ``` my-label && (( ! status = "disabled by owner" || version==latest && minor===2) && feature-flaf!="foreign" )
     * 
     * 
     */
    filterElements<T extends UfeElement>(elements: Array<T>, selector?: string): Array<T>
    
}

/**  use this function to reliable retrieve instance of 
 * the UfeRegistry interface */
export const getUfeRegistryAsync = () => UfeRegistryImpl.instanceAsync(false);

/**  Do not use directly! Used internally by ufe-controller main page, to create a 
 *   instance of UfeRegistry and bootstrap the micro-frontend environment
 **/
export function installUfeRegistry() {
    window.addEventListener("load", async _ => {
        if(window.ufeRegistry) return;
        UfeRegistryImpl.instanceAsync(true);
    }) 
}

// implementation of the interface
class UfeRegistryImpl implements UfeRegistry{

    private constructor() {};

    private webConfig: UfeConfiguration|null = null;

    public readonly router: Router = createRouter();

    get userId(): string|undefined {
       return  this.webConfig?.user?.id;
    }

    get userinfo(): UfeUserInfo|undefined {
        return this.webConfig?.user;
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
        return this.basePath + path
    }

    
    private async loadComponents() {
        if(this.webConfig != null) {
            return this.webConfig;
        }
        else {
            
            let response = await fetch(`${this.basePath}fe-config`);
            if(response.status == 404) {
                this.webConfig = null
                return;
            }
            this.webConfig  = await response.json();
            let preloads = this.webConfig != null ? this.webConfig.preload : [];
            await this.preloadDependenciesAsync(preloads)
        }
    }

    static async instanceAsync(create:boolean = false): Promise<UfeRegistry> {
        if(create){
            const ufeRegistry =  new UfeRegistryImpl();
            await ufeRegistry.loadComponents();
            await ufeRegistry.createAppShell();
            window.ufeRegistry = ufeRegistry;
        }
        
        return new Promise(async ( resolve, _) => {
            while(!(window.ufeRegistry) )
            {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            resolve(window.ufeRegistry);
        })
    }

    navigableApps(selector: string = "" ): UfeWebApp[]  {
        return this
            .matchSelector(this.webConfig?.apps ?? [],selector)
            .sort( (a, b) => b.priority  - a.priority)
            .map( _ => {
                _.isActive = location.pathname.startsWith(this.rebasePath(_.path))
                return _
            });
    }

    contextElements(context: string, selector:string = ""): UfeContext[]  {
        return this
            .matchSelector(this.webConfig?.contexts ?? [], selector)
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

    loadAndRenderElement(element: UfeElement, extraAttributes?: { [name: string]: any }):any {
        this.preloadDependenciesAsync([element]);
        const El = element.element;
        
        const attr = Object.assign(
            {}, 
            extraAttributes, 
            element.attributes.reduce( 
                (acc, a) => { 
                    acc[a.name] = a.value;
                    return acc}, {} as {[name:string]:any
                })
        );
        return (<El { ...attr }></El>)
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

    private matchSelector<T extends UfeElement>( elements: T[], selector:string ):  T[]  {
        if( elements === undefined  || elements === null || elements.length == 0) return [];
        const metas =  document.getElementsByTagName('meta');
        let serverSelector = ""
        // combine with page selector specifier
        for (let i = 0; i < metas.length; i++) {
            if (metas[i].getAttribute('name') === "ufe-selector") {
              const content =  metas[i].getAttribute('content');
              if(content) {
                serverSelector = content};
              }
            }
        // filter applications by selector
        return this.filterElements( 
            this.filterElements(elements, serverSelector), 
            selector) 
    };

    filterElements<T extends UfeElement>(elements: T[], selector?: string | undefined): T[] {
        if(!selector){
            return elements;
        }
        const parser = new SelectorParser();
        const expression = parser.parse(selector) as SelectorExpression;
        return elements.filter(_ => this.evaluateSelector( _, expression))
        
    }

    private evaluateSelector<T extends UfeElement>(element: T, expression: SelectorExpression) : boolean {
        
        switch(expression.operation){
            case "not": 
                return  ! this.evaluateSelector(element, expression.operands[0] as SelectorExpression)
            case "exists": {
                const l = expression.operands[0] as string
                return   !!element.labels && !!element.labels[l]
            }
            case "equals": {
                const l = expression.operands[0] as string
                const v = expression.operands[1] as string
                return   !!element.labels && element.labels[l]==v
            }
            case "and": {
                const left = expression.operands[0] as SelectorExpression;
                const right = expression.operands[1] as SelectorExpression;
                return this.evaluateSelector(element, left) && this.evaluateSelector(element, right)
            }
            case "or": {
                const left = expression.operands[0] as SelectorExpression;
                const right = expression.operands[1] as SelectorExpression;
                return this.evaluateSelector(element, left) || this.evaluateSelector(element, right)
            }
            default: return false
        }
    }

    private async createAppShell() {
        const metas =  document.getElementsByTagName('meta');
        var context: string = "";
        for (let i = 0; i < metas.length; i++) {
            if (metas[i].getAttribute('name') === "ufe-shell-context") {
              context =  metas[i].getAttribute('content') ?? "";
              break;
            }
          }
        const shell = this.contextElements(context)[0] || {
            element: "ufe-default-shell",
            attributes: [],
            load_url: "",
            roles: ["*"]
        };
        await this.preloadDependenciesAsync([shell]);

        const element = document.createElement(shell.element);
        shell.attributes.forEach( 
            attribute => element.setAttribute(
                attribute.name, attribute.value));
        
        document.body.appendChild(element);
    }
}

