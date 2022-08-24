import { Router } from "stencil-router-v2";
/**  Module specification */
export interface UfeModule {
    /** URL from which the module can be loaded */
    load_url: string;
    /** List of URLs to CSS files to be loaded with the module */
    styles?: string[];
}
export interface UfeElement extends UfeModule {
    /** element tag that shall be placed into the page  */
    element: string;
    /** list of preconfigured attributes for the element
     * when element tag is rendered */
    attributes: Array<{
        name: string;
        value: any;
    }>;
    /** list of labels associated with the element.
     * Used to select the subset of elements from the list
     */
    labels?: {
        [name: string]: string;
    };
    /** Roles of users that shall see this element */
    roles?: string[];
}
export interface UfeWebApp extends UfeElement {
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
/** Primary API interface for accessing registered micro apps  */
export interface UfeRegistry {
    /** global stencil router for application routing.
     * The application can use it as a base for the subrouting */
    router: Router;
    /** base path of the application shell, if served on server subpaths */
    basePath: string;
    /** rebases(prefixes) paths by taking into consideration the basePath */
    rebasePath(path: string): string;
    /** helper function to provide elements with navigation functionality */
    href(href: string, router?: Router): {
        href: any;
        onClick: (ev: any) => void;
    };
    /** list of navigable web-components - aka micro applications */
    navigableApps(selector?: {
        [name: string]: string;
    }): UfeWebApp[];
    /** list of context specific web components */
    contextElements(context: string, selector?: {
        [name: string]: string;
    }): UfeContext[];
    /** dynamically loads module dependnecies */
    preloadDependenciesAsync(elements: UfeModule[]): Promise<void>;
    /** renders registered web-component(element) into html text that
     * can be then put into DOM
     */
    elementHtmlText(element: UfeElement): string;
    /** retrieves information about user */
    get userId(): string | undefined;
}
/**  use this function to reliable retrieve instance of
 * the UfeRegistry interface */
export declare const getUfeRegistryAsync: () => Promise<UfeRegistry>;
/**  Do not use directly! Used internally by ufe-controller main page, to create a
 *   instance of UfeRegistry and bootstrap the micro-frontend environment
 **/
export declare function installUfeRegistry(): void;
