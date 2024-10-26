import * as ts from 'typescript';
import * as iconMigration from './icon-angular-migration.json';
import { SchematicContext, Tree } from '@angular-devkit/schematics';
import { strings } from '@angular-devkit/core';
import { parseFragment, serialize } from 'parse5';
import { getWorkspace } from '@schematics/angular/utility/workspace';
import {
  Change,
  InsertChange,
  RemoveChange
} from '@schematics/angular/utility/change';
import {
  addImportToModule,
  findNodes,
  isImported
} from '@schematics/angular/utility/ast-utils';
import { getSourceNodes } from '@schematics/angular/utility/ast-utils'
import { Element } from 'parse5/dist/tree-adapters/default';
import {
  isIconPathAlreadyImported,
  insertDefaultImport,
  findImportDeclaration,
  findArrayLiteralExpression
} from './utils';


interface IconMetadata {
  path: string;
  size: string;
  name: string;
}

// Object map for replacing HTML tags
const replacementMap: { [key: string]: string } = iconMigration;

function importIconModule(modulePath: string, tree: Tree) {
  const sourceText = tree.read(modulePath)?.toString('utf-8') || '';
  const sourceFile = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

  const recorder = tree.beginUpdate(modulePath);

  // Add IconModule to the imports array in the NgModule
  const moduleImportChange = addImportToModule(sourceFile, modulePath, 'IconModule', 'carbon-components-angular');
  moduleImportChange.forEach(change => {
    if (change instanceof InsertChange) {
      recorder.insertLeft(change.pos, change.toAdd);
    }
  });

  tree.commitUpdate(recorder);
  return tree;
}

function importIconService(modulePath: string, tree: Tree) {
  const sourceText = tree.read(modulePath)?.toString('utf-8') || '';
  const sourceFile = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

  const recorder = tree.beginUpdate(modulePath);

  // Import IconService if it isn't already imported
  if (!isImported(sourceFile, 'IconService', 'carbon-components-angular')) {
    const importDeclaration = findImportDeclaration(sourceFile, 'carbon-components-angular');
    if (importDeclaration) {
      const importClause = importDeclaration.importClause;

      // Get the named bindings (symbols between the curly braces)
      if (importClause && importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
        const namedImports = importClause.namedBindings.elements;

        // Check if 'IconService' is already imported
        const hasIconService = namedImports.some(element => element.name.getText() === 'IconService');
        if (!hasIconService) {
          // Add 'IconService' to the import statement
          const lastImport = namedImports[namedImports.length - 1];
          recorder.insertRight(lastImport.getEnd(), `, IconService`);
        }
      }
    }
  }

  tree.commitUpdate(recorder);
  return tree;
}

function importIconPath(modulePath: string, icon: IconMetadata, tree: Tree) {
  const sourceText = tree.read(modulePath)?.toString('utf-8') || '';
  const sourceFile = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

  const recorder = tree.beginUpdate(modulePath);

  // Check if import with path does not exist in file
  const iconImportPath = `${icon.path}${icon.size}`;
  const importClauseIdentifier = strings.classify(icon.name + icon.size);
  if (!isIconPathAlreadyImported(sourceFile, iconImportPath)) {
    const iconImportChange = insertDefaultImport(sourceFile, `import ${importClauseIdentifier} from "${iconImportPath}";`);
    const change = new InsertChange(
      iconImportChange.fileName,
      iconImportChange.position,
      iconImportChange.importStatement
    );
    recorder.insertLeft(change.pos, change.toAdd);
  }

  tree.commitUpdate(recorder);
  return tree;
}

function removeIconsAngularImports(modulePath: string, tree: Tree) {
  const sourceText = tree.read(modulePath)?.toString('utf-8') || '';
  const sourceFile = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

  const recorder = tree.beginUpdate(modulePath);

  const changes: Change[] = [];
  const importDeclaration = findNodes(sourceFile, ts.SyntaxKind.ImportDeclaration) as ts.ImportDeclaration[];

  const iconImportToRemoveSet = new Set<string>();

  // Find all of the imports that import from `@carbon/icons-angular`.
  importDeclaration.forEach(declaration => {
    const moduleSpecifier = declaration.moduleSpecifier.getText();

    if (moduleSpecifier.includes('@carbon/icons-angular')) {
      const namedBindings = declaration.importClause?.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        namedBindings.elements.forEach((element) => {
          iconImportToRemoveSet.add(element.getText());
        })
      }

      changes.push(
        new RemoveChange(
          sourceFile.fileName,
          declaration.getStart(sourceFile),
          declaration.getFullText(sourceFile)
        )
      );
    }
  });

  // Get ngModuleNode to remove `icon-angular` modules from imports
  const ngModuleNode = findNodes(sourceFile, ts.SyntaxKind.Decorator).find((node) => {
    return ts.isDecorator(node) &&
      (node.expression as ts.CallExpression).expression.getText(sourceFile) === 'NgModule';
  }) as ts.Decorator;

  if (ngModuleNode) {
    const expression = ngModuleNode.expression;

    if (ts.isCallExpression(expression)) {
      const decoratorParameterObject = expression.arguments[0];

      if (decoratorParameterObject && ts.isObjectLiteralExpression(decoratorParameterObject)) {
        const importsListNode = decoratorParameterObject.properties.find(key =>
          ts.isPropertyAssignment(key) && key.name.getText(sourceFile) === 'imports');

        if (importsListNode && ts.isPropertyAssignment(importsListNode) && ts.isArrayLiteralExpression(importsListNode.initializer)) {
          const arrayElements = importsListNode.initializer.elements;

          arrayElements.forEach((element, index) => {
            const elementText = element.getText(sourceFile);

            // If the import is in the set, remove it from the array
            if (iconImportToRemoveSet.has(elementText)) {
              const end = element.getEnd();

              changes.push(
                new RemoveChange(
                  sourceFile.fileName,
                  element.getStart(sourceFile),
                  element.getFullText(sourceFile)
                )
              );

              // Also remove the comma following the element (if any)
              const nextToken = arrayElements[index + 1];
              /**
               * @todo - nextToken || sourceFile.text[end] === ',' ?? Do we use Or operator 
               * or do we need to short circuit 
               */
              if (nextToken || sourceFile.text[end] === ',') {
                console.log('next Token', nextToken.getText() + sourceFile.text[end]);
                changes.push(
                  new RemoveChange(sourceFile.fileName, end, ',')
                );
              }
            }
          });
        }
      }
    }
  }

  changes.forEach(change => {
    if (change instanceof RemoveChange) {
      recorder.remove(change.order, change.toRemove.length - 1);
    }
  });

  tree.commitUpdate(recorder);
  return tree;
}


// Helper function to add IconService and ensure registerAll is called in the 
// Add IconService to the constructor and ensure registerAll is called
function addIconServiceToConstructor(modulePath: string, icon: IconMetadata, tree: Tree) {
  const sourceText = tree.read(modulePath)?.toString('utf-8') || '';
  const sourceFile = ts.createSourceFile(modulePath, sourceText, ts.ScriptTarget.Latest, true);

  const recorder = tree.beginUpdate(modulePath);
  const nodes = getSourceNodes(sourceFile);

  let constructorNode: ts.Node | undefined;
  let classNode: ts.ClassDeclaration | undefined;
  let arrayNodes: ts.Expression[] = [];
  let iconServiceAlreadyInjected = false;
  let registerAllCalled = false;

  // Extract icon names from the replacement map for the registerAll call
  const classifiedIcon = strings.classify(icon.name + icon.size);
  const iconList = [classifiedIcon];

  // Find the constructor and class nodes
  nodes.forEach((node: ts.Node) => {
    if (ts.isConstructorDeclaration(node)) {
      constructorNode = node;
      const constructorText = node.getText();
      console.log(constructorText);

      // Check if IconService is already injected
      if (constructorText.includes('IconService')) {
        iconServiceAlreadyInjected = true;
      }

      // Check if registerAll is already called
      if (constructorText.includes('this.iconService.registerAll')) {
        registerAllCalled = true;
        // Retrieve existing array literal expression & append to icon list
        arrayNodes = findArrayLiteralExpression(node);
        arrayNodes?.forEach(node => {
          if (node.getText().trim() !== classifiedIcon)
            iconList.push(node.getText().trim());
        });
      }
    }
    if (ts.isClassDeclaration(node)) {
      classNode = node;
    }
  });

  const changes: InsertChange[] = [];

  // If the constructor exists and IconService is not injected, add it
  if (constructorNode && !iconServiceAlreadyInjected) {
    const changePos = constructorNode.getStart() + 'constructor('.length;
    changes.push(new InsertChange(modulePath, changePos, 'private iconService: IconService, '));
  }

  // If no constructor exists, create one and inject IconService
  if (!constructorNode && classNode) {
    const classPos = classNode.getEnd() - 1;
    changes.push(new InsertChange(
      modulePath,
      classPos,
      `
constructor(private iconService: IconService) { 
  this.iconService.registerAll([${iconList.join(', ')}]);
}
      `
    ));
  }

  // If the constructor exists but registerAll is not called, add the registerAll call
  if (constructorNode && !registerAllCalled) {
    const constructorBodyPos = constructorNode.getEnd() - 1;
    // Read content of the list

    changes.push(new InsertChange(
      modulePath,
      constructorBodyPos,
      `this.iconService.registerAll([${iconList.join(', ')}]);`
    ));
  }

  if (constructorNode && registerAllCalled) {
    const arrayStartPos = arrayNodes[0].getStart();
    // Read content of the list

    changes.push(new InsertChange(
      modulePath,
      arrayStartPos,
      `${classifiedIcon}, `
    ));
  }

  changes.forEach((change) => {
    recorder.insertLeft(change.pos, change.toAdd);
  })

  tree.commitUpdate(recorder);
  return tree;
}



// Update the specific NgModule for the updated component
function updateNgModuleForComponent(modulePath: string, icon: IconMetadata, tree: Tree, context: SchematicContext) {
  if (!tree.exists(modulePath)) {
    context.logger.error(`Module file not found: ${modulePath}`);
    return tree;
  }

  removeIconsAngularImports(modulePath, tree);
  importIconModule(modulePath, tree);
  importIconService(modulePath, tree);
  importIconPath(modulePath, icon, tree);
  addIconServiceToConstructor(modulePath, icon, tree);


  context.logger.info(`Updated module file: ${modulePath}`);
  return tree;
}


// Find the corresponding NgModule file for a component and update it
function findModuleForComponent(tree: Tree, componentPath: string, icon: IconMetadata, context: SchematicContext) {
  const componentDir = componentPath.substring(0, componentPath.lastIndexOf('/'));

  // In root, there is nothing to search
  if (!componentDir) {
    context.logger.error('Root reached, moving on.');
    return tree;
  }

  tree.getDir(componentDir).visit(filePath => {
    if (filePath.endsWith('.module.ts') && !filePath.includes('routing')) {
      // Check if it's content contains '${appname}.component`
      const fileBuffer = tree.read(filePath);
      if (fileBuffer) {
        const fileContent = fileBuffer.toString('utf-8');

        const componentToSearch = componentPath.split('/');
        const fileToSearch = componentToSearch[componentToSearch.length - 1].replace('.html', '');

        // It exists in module file
        if (fileContent.includes(fileToSearch)) {
          context.logger.info(`Component found in: ${componentPath}, size: ${icon.size}`);
          return updateNgModuleForComponent(filePath, icon, tree, context);
        } else {
          // Travel up the parent dir
          context.logger.info(`Module files do not import the component ${componentPath}. Attempting to look into parent directory.`);
          return findModuleForComponent(tree, componentDir, icon, context);
        }
      }
    }
  });

  return tree;
}

// Function to recursively replace HTML 
function replaceHtmlTags(
  element: Element,
  replacements: { [key: string]: string },
  context: SchematicContext,
  srcTree: Tree,
  filePath: string
) {
  // If the tag exists, we replace!
  if (replacements[element.tagName]) {
    const iconKeyValue = (replacements[element.tagName]).split('/');
    const ibmIconValue = iconKeyValue[iconKeyValue.length - 2];

    const icon: IconMetadata = {
      name: ibmIconValue,
      size: "16",
      path: replacements[element.tagName]
    };

    element.tagName = 'svg';
    element.attrs.push({ 'name': 'ibmIcon', 'value': ibmIconValue });

    // Track back to module and add it to module
    findModuleForComponent(srcTree, filePath, icon, context);
  } else if (element.tagName === "div" || element.tagName === "svg") {  // Check the element attributes to see if the icon directive isn't used
    element.attrs.some((attr, index) => {
      // Directive found, replace
      if (replacements[attr.name.toLowerCase()]) {
        const iconKeyValue = (replacements[attr.name.toLowerCase()]).split('/');
        const ibmIconValue = iconKeyValue[iconKeyValue.length - 2];
        // Convert tag to svg + use ibmIcon directive.

        const icon: IconMetadata = {
          name: ibmIconValue,
          size: "16",
          path: replacements[attr.name.toLowerCase()]
        };

        element.tagName = "svg";
        element.attrs[index].name = "ibmIcon";
        element.attrs[index].value = ibmIconValue;

        // Track back to module and add it to module
        findModuleForComponent(srcTree, filePath, icon, context);
      }
    })
  }

  // Recursively go through all nodes & as long as it isn't text, replace!
  if (element.childNodes) {
    element.childNodes.forEach((child: any) => {
      if (child.nodeName !== '#text') {
        replaceHtmlTags(child, replacements, context, srcTree, filePath);
      }
    });
  }
}



// Rule entry
export function migrateIconPkg() {
  return async (tree: Tree, context: SchematicContext) => {

    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get('IconsMigrationtest');

    if (project?.sourceRoot) {
      // Get directory to start searching for the templates in
      const srcTree = tree.getDir(project.sourceRoot);

      // Modify all HTML files in the tree
      srcTree.visit(filePath => {
        // Check only component html files
        if (filePath.endsWith('component.html')) {
          const fileBuffer = tree.read(filePath);
          if (fileBuffer) {
            const fileContent = fileBuffer.toString('utf-8');

            // Parse the HTML using parse5
            const document = parseFragment(fileContent) as Element;
            // Start parsing the template from root
            replaceHtmlTags(document, replacementMap, context, tree, filePath);

            // Serialize the modified HTML back to string
            const modifiedContent = serialize(document);

            // Overwrite the file with modified content
            tree.overwrite(filePath, modifiedContent);
          }
        }
      });
    }

    return tree;
  };
}
