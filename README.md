# Getting Started With Schematics

If you're asking about the schematics to upgrade, use the following:
Carbon Icons - ng g @buc/schematics:migrate-carbon-11-pkg
Carbon 11 - ng g @buc/schematics:migrate-icons-angular-pkg


### Tasks for developers (Migration guide)

* Migrate from `button[iconOnly="true"]` ->  `cds-icon-button`
* `buc-checkbox` no longer emits `change` event, use `checkedChange` going forward.
	* Adding backwards compatibility for current version.
* `buc-structured-list` no longer has `border` or `nowrap` attributes (Remove)
* Progress Indicator no longer supports tooltip
	* See progress indicator changes in CCA migration guide
* Combobox now emits an array of selected items instead of an object with items key that has an array value.
	* Added backwards compatibility for current version. 
* Tables no longer support multi-row headers
	* Tables now only support the following size: `sm`, `md`, `lg`, `xl`, `2xl`
	* We have stricter types, you will need to type cast to use `BucTableHeaderItem` or use `BucTableHeaderItem`.


### Migration guide
* Replace imports from `carbon-components` with `@carbon/styles`. 
* Uninstall `@carbon/theme`, `@carbon/type`, `@carbon/colors`. All of these packages are already part of `@carbon/styles`. Installing them separately can lead to version mismatch and style issues.
* Page header -> For all page header component buttons, remove `sm` sizing (Will opt for default `md` size).
* Pipes should NOT be injected (They should not be in providers). Create an instance of the pipe.
* Combobox now emits an array of selected items instead of an object with items key that has an array value.
* Checkbox (change) event is deprecated, will be removed in future version. Use `checkedChange` instead.


---




## Utils upgrade guide
```
yarn nx migrate latest --to=nx@17.0.6 --interactive --verbose
```
Remove `nx` from scripts

```
yarn nx migrate --run-migrations --verbose
```

```
yarn nx migrate @angular/core@17 @angular/cli@17 --interactive --verbose
```



## Steps for updating a buc-app-`${repo}`

For each Angular version upgrade, make sure to remove packages such as `@angular/material` or `@angular/cdk` if they are not part of the package.json & include any dependency that should be part of the upgrade.

Why are we using force? There will be peer dependency errors with utils libraries. We have no releases with Angular 16 & 17 for utils lib, hence we won't be able to test the updates. Additionally, we use `full` ivy compilation, meaning the version HAS to match in order to test. So we have to directly update to Angular 18 and then bump utils libs. We upgrade the util libs AFTER to not pollute the node_modules and yarn.lock with multiple versions of Angular.

The following migration steps may vary if the project is not a lerna project. (Ex. buc-app-sfo, storefront). In such cases, upgrade has to be step-by-step, so upgrading angular first THEN upgrading material and other dependencies.
#### Angular 16
```bash
yarn ng update @angular/core@16 @angular/cli@16 @angular-builders/custom-webpack@16 @angular/cdk@16 @angular-eslint/schematics@16 @angular/material@16 --force
```

We use force due to peer dependencies of `common-components`. Ensure you include any other dependency part of the update.

#### Angular 17
```bash
yarn ng update @angular/core@17 @angular/cli@17 @angular-builders/custom-webpack@17 @angular/cdk@17 @angular-eslint/schematics@17 @angular/material@17 --force
```

Uninstall `@angular-devkit/build-ng-packagr` - it is deprecated and we can use `@angular-devkit/build-angular`.

#### Angular 18
```bash
yarn ng update @angular/core@18 @angular/cli@18 @angular-builders/custom-webpack@18 @angular/cdk@18 @angular-eslint/schematics@18 @angular/material@18 --force
```

When running this command you will encounter an optional migration to use application builder (`use-application-builder`), press enter to proceed because we do NOT use `@angular-devkit/build-angular:browser-esbuild` or `@angular-devkit/build-angular:browser`.

Run:
```bash
yarn add -D @types/topojson-specification -W
```
We add this since it is a peer dependency for a carbon charts which is dependency for common-components. This probably requires a fix upstream. Faster solution until we get that resolved in @carbon/charts-angular.

 Before committing, make sure to lint your `changed` module files.
* You may need to manually remove `HttpClientModule` from the module in case there are multiple imports...

Run the migration script, it will update the entire workspace (all projects in the repo).
* You will need to update the the asset directory (styles) and styles.scss.

### Link and install
```bash
yarn link @buc/common-components && yarn link @buc/svc-angular && yarn install && yarn start-app --overrides-json overrides.json
```

### Update the packages

```json
"@carbon/charts-angular": "1.17.0",
"@carbon/icons": "11.52.0",
"@carbon/styles": "1.69.0",
"@ngx-translate/core": "14.0.0",
"@ngx-translate/http-loader": "7.0.0",
"ngx-cookie": "6.0.1"
```



`