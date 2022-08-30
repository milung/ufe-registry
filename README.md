# Registry of microfrontend's elements and apps

This module is a supportive module for customization and reflection of the web components registered at the [milung/ufe-controller](https://github.com/milung/ufe-controller#readme) kubernetes controller.

Once the application shell of the _ufe-controller_ is loaded into browser, the `UfeRegistry` instance can be used to retrieve which
application web-components, modules, and context elements are registered
in the kubernetes cluster. The `UfeRegistry` may be used to replace the default application shell or to create custom web-components that will display other context specific elements.

## Instalation

```sh
npm i --save ufe-registry
```

## Example

* Creating custom list of navigable elements and placeholder for displaying the current app, using [Stencil JS](https://stenciljs.com/) framework

  ```tsx
  import { Component, Host, h, State, Prop } from '@stencil/core';
  import { Router } from 'stencil-router-v2';
  import { getUfeRegistryAsync, UfeRegistry} from "ufe-registry"

  @Component({
    tag: 'my-shell',
    styleUrl: 'my-shell.css',
    shadow: true,
  })
  export class MyShell {

    @Prop() router: Router; // use subrouter if your app is hosted in another web-component
    
    ufeRegistry: UfeRegistry;

    async componentWillLoad() {
      this.ufeRegistry = await getUfeRegistryAsync() // wait for UfeRegistry being available
    }
    
    render() {
      const apps = this.ufeRegistry.navigableApps() // get list of applications registered in cluster
      <my-shell>
        <navigation-panel>
            <tabs>
              {apps.map( app => {
                const active = false
                (<app-tab
                    label={app.title} 
                    {...this.ufeRegistry.href(app.path, this.router || this.ufeRegistry.router)}
                    active={app.isActive} ></app-tab>
                )})}
            </tabs>    
        </navigation-panel>
        <ufe-app-router></ufe-app-router>   // shows the webcomponent of the currently active app
      </my-shell>
    }
  ```

* Rendering the context elements of the named context `my-context`:

  ```tsx
  render() {
    
    const functions = this.ufeRegistry.contextElements("my-context", this.selector)

    return (
      <Host>
        {functions.map( this.ufeRegistry.loadAndRenderElement)}
      </Host>
    )
  }
  ```
