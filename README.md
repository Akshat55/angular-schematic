# Upgrading to Angular 18

We've upgraded to Angular 18 & in the process upgraded to the latest version of IBM's carbon design system. These changes bring faster install, start & build times to the application. This guide will walk you through the migration steps for your _**custom**_ applications for the following types of custom apps

1. New monorepo
2. New custom angular app


For each Angular version upgrade, make sure to remove packages such as `@angular/material` or `@angular/cdk` if they are not part of the `package.json` & include any dependency that should be part of the upgrade.

The following migration steps may vary if the project is not a lerna project. In such cases, upgrade must be step-by-step, so upgrading angular first THEN upgrading material and other dependencies.

### I. Updating to Angular 16

We use force due to peer dependencies incompatibility of common-components package. Ensure you include any other dependency part of the update. 

Notice how we do not include `@angular-builders/custom-webpack@16` in upgrade for standalone projects and how it is split into two commands instead of a single. 

**Standalone angular project**:

```bash
yarn ng update @angular/core@16 @angular/cli@16 --force

yarn ng update @angular/cdk@16 @angular-eslint/schematics@16 @angular/material@16 --force
```

**Monorepo:**

```bash
yarn ng update @angular/core@16 @angular/cli@16 @angular-builders/custom-webpack@16 @angular/cdk@16 @angular-eslint/schematics@16 @angular/material@16 --force
```

### II. Updating to Angular 17

Uninstall `@angular-devkit/build-ng-packagr` package if it exists in your **package.json** - it is deprecated in favor @angular-devkit/build-angular.

**Standalone angular project**:

```bash
yarn ng update @angular/core@17 @angular/cli@17 --force

yarn ng update @angular/cdk@17 @angular-eslint/schematics@17 @angular/material@17 --force
```

**Monorepo:**

```bash
yarn ng update @angular/core@17 @angular/cli@17 @angular-builders/custom-webpack@17 @angular/cdk@17 @angular-eslint/schematics@17 @angular/material@17 --force
```

### II. Updating to Angular 18

**Standalone angular project**:

```bash
yarn ng update @angular/core@18 @angular/cli@18 --force

yarn ng @angular/cdk@18 @angular-eslint/schematics@18 @angular/material@18 --force
```

**Monorepo:**

```bash
yarn ng update @angular/core@18 @angular/cli@18 @angular-builders/custom-webpack@18 @angular/cdk@18 @angular-eslint/schematics@18 @angular/material@18 --force
```

When running this command, you will encounter an optional migration prompt to use application builder (use-application-builder). If you're upgrading a _monorepo_, press enter to proceed as we do NOT use `@angular-devkit/build-angular:browser-esbuild` or `@angular-devkit/build-angular:browser` builder.

### Post Angular upgrade

*  Make sure to lint your changed module files, you may need to manually remove `HttpClientModule` if the schematics did correctly remove them.
* Update your `.eslintrc.json` files. You will remove two of the plugin extensions and add one.

```json
"extends": [
  "plugin:@angular-eslint/ng-cli-compat",                      // - Remove
  "plugin:@angular-eslint/ng-cli-compat--formatting-add-on",   // - Remove
  "plugin:@angular-eslint/recommended",                        // + Add
  "plugin:@angular-eslint/template/process-inline-templates"   // No Change
],
```

* Install the `@types/topojson-specification` dependency:
```bash
yarn add -D @types/topojson-specification ## (include `-W` for lerna monorepo)
```

* Update all `@buc` namespace packages in your project to use the latest available versions. You will have to change the versions to the latest.

---
# Carbon Upgrade

There are two steps to the carbon upgrade. We've built out schematics to assist with the upgrade. 
### Carbon Icons upgrade

Navigate to the module directory & execute the icon upgrade schematic using the following command:

```bash
cd MODULE ## Navigate to the app you want to upgrade

ng g @buc/schematics:migrate-icons-angular-pkg
```

This will update all instances of `<ibm-icon-*` in your HTML file to use the new icon directives. This will also create declaration files (`module.d.ts`), if none exist. 

If you see `@carbon/icons-angular` package in your `package.json`, remove it as this package is now deprecated.


Examples of importing & using `@carbon/icons` is explained here:

https://github.com/carbon-design-system/carbon-components-angular/wiki/v4-to-v5-upgrade-guide#carbonicons-angular

### Carbon upgrade

Navigate to the module directory & execute the carbon upgrade schematic using the following command:

```bash
cd MODULE ## Navigate to the app you want to upgrade

ng g @buc/schematics:migrate-icons-angular-pkg

## Verify your package.json changes & install
yarn install
```

The above schematic will update your `*.html`, `*.scss` & `package.json` files. We now use `cds--` prefix for css classes. We also recommend testing for any `bx--` prefix that have been missed, specifically the JSON files in assets directories.
```ts
/**
 * @todo
 * We should automate the prefix migration for JSON files too,
 * I recently discovered that`buc-field-details.json` can have container classes.
 */
```


##### Styling update

You may encounter variable conflicts. Your `styles.scss` should only be importing from `@carbon/styles` & `@carbon/charts`. No other carbon packages need to be imported. Remove any references to them.

Carbon 11 makes use of css variables, to set up themes & carbon styling, see the following guide:
```ts
/**
 * @todo
 * Add link to carbon components angular
 */
```

By default, all variables are imported without the need of using namespaces. If you run into any conflicts, remove the `as *;` from the `@use` statement. 

<table>
	<tr>
		<th>Before (No namespace for imports)</th>
		<th>After (Adding namespace)</th>
	</tr>
	<tr>
		<td>
		```scss<br>
		@use '@carbon/colors' as *;<br>
		$primary-color: $blue-40;<br>
		```
		</td>
		<td>
		```scss<br>
			@use '@carbon/colors';<br>
			$primary-color: colors.$blue-40;<br>
		```
		</td>
	</tr>
</table>


For more information on carbon styling upgrade see the following migration guide: 
https://github.com/carbon-design-system/carbon/blob/main/docs/migration/v11.md

Filter by the `@carbon` dependencies in your `package.json`.


##### Components update

* Buttons no longer support `field` size, instead use `md`.
* Migrate from `button[iconOnly="true"]` ->  `cds-icon-button`
	* You can still use `buc-button[iconOnly="true"]`, but will not support tooltip.
* `buc-checkbox`/`buc-toggle` no longer emits `change` event, use `checkedChange` going forward.
	* Minimal backwards compatability exists for now.
* `buc-structured-list` no longer has `border` or `nowrap` attributes (Remove)
* Combobox now emits an array of selected items instead of an object with items key that has an array value.
	* Added backwards compatibility for current version. This will be removed in future releases.
* Tables no longer support multi-row headers
	* Tables now **only** support the following size: `sm`, `md`, `lg`, `xl`, `2xl`
	* We have stricter types, you _may_ need to type cast to use `BucTableHeaderItem`.
* Page header -> For all page header component buttons, remove `sm` sizing (Will opt for default `md` size).
	* This is needed to correctly align the buttons & icons
* Tooltips are now inline for accessibility reasons, there may be cases where they are clipped. Pass `[autoAlign]="true"` for best placement.
	* `buc-tooltip-icon` is deprecated & will be removed in next major version
* Progress Indicator - `stepClicked` event is now deprecated as it is and has been redundant to `stepSelected` event.


You can find additional changes related to carbon components angular here:

https://github.com/carbon-design-system/carbon-components-angular/wiki/v4-to-v5-upgrade-guide#common-changes

