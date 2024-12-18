import * as ts from 'typescript';
import * as iconMigration from './icon-angular-migration.json';
import { DirEntry, Tree } from '@angular-devkit/schematics';
import { strings } from '@angular-devkit/core';
import { parseFragment } from 'parse5';
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
  let registerAllExistsAndIconToAddExists = false;

  // Extract icon names from the replacement map for the registerAll call
  const classifiedIcon = strings.classify(icon.name + icon.size);
  const iconList = new Set<string>();
  iconList.add(classifiedIcon);

  // Find the constructor and class nodes
  nodes.forEach((node: ts.Node) => {
    if (ts.isConstructorDeclaration(node)) {
      constructorNode = node;
      const constructorText = node.getText();
      // Check if IconService is already injected
      if (constructorText.includes('IconService')) {
        iconServiceAlreadyInjected = true;
      }

      // Check if registerAll is already called
      if (constructorText.includes('iconService.registerAll')) {
        registerAllCalled = true;
        // Retrieve existing array literal expression & append to icon list
        arrayNodes = findArrayLiteralExpression(node);
        arrayNodes?.forEach(node => {
          if (node.getText().trim() !== classifiedIcon) {
            iconList.add(node.getText().trim());
          } else {
            registerAllExistsAndIconToAddExists = true;
          }
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
  iconService.registerAll([${Array.from(iconList).join(', ')}]);
}
      `
    ));
  }

  // If the constructor exists but registerAll is not called, add the registerAll call
  if (constructorNode && !registerAllCalled) {
    const constructorBodyPos = constructorNode.getEnd() - 1;
    changes.push(new InsertChange(
      modulePath,
      constructorBodyPos,
      `iconService.registerAll([${Array.from(iconList).join(', ')}]);`
    ));
  }

  if (constructorNode && registerAllCalled && !registerAllExistsAndIconToAddExists) {
    const arrayStartPos = arrayNodes[0].getStart();
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
function updateNgModuleForComponent(modulePath: string, icon: IconMetadata, tree: Tree) {
  if (!tree.exists(modulePath)) {
    console.error(`Module file not found: ${modulePath}`);
    return tree;
  }

  removeIconsAngularImports(modulePath, tree);
  importIconModule(modulePath, tree);
  importIconService(modulePath, tree);
  importIconPath(modulePath, icon, tree);
  addIconServiceToConstructor(modulePath, icon, tree);


  console.info(`Updated module file: ${modulePath}`);
  return tree;
}


// Find the corresponding NgModule file for a component and update it
function findModuleForComponent(
  tree: Tree,
  componentPath: string,
  modulePaths: string[],
  icon: IconMetadata
) {
  const componentDir = componentPath.substring(0, componentPath.lastIndexOf('/'));

  // In root, there is nothing to search
  if (!componentDir) {
    console.error('Root reached, moving on.');
    return tree;
  }

  modulePaths.forEach(modulePath => {
    // Check if it's content contains '${appname}.component`
    const fileBuffer = tree.read(modulePath);
    if (fileBuffer) {
      const fileContent = fileBuffer.toString('utf-8');

      const componentToSearch = componentPath.split('/');
      const fileToSearch = componentToSearch[componentToSearch.length - 1].replace('.html', '');

      // It exists in module file
      if (fileContent.includes(fileToSearch)) {
        updateNgModuleForComponent(modulePath, icon, tree);
      }
    }
  })
}

function findModuleFiles(tree: DirEntry): string[] {
  const modulePaths: string[] = [];

  tree.visit(filePath => {
    if (filePath.endsWith('.module.ts') && !filePath.includes('routing')) {
      modulePaths.push(filePath);
    }
  });

  return modulePaths;
}

// Function to recursively replace HTML 
function replaceHtmlTags(
  element: Element,
  srcTree: Tree,
  filePath: string,
  modulePaths: string[]
) {
  // If the tag exists, we replace!
  if (replacementMap[element.tagName]) {
    const iconKeyValue = (replacementMap[element.tagName]).split('/');
    const ibmIconValue = iconKeyValue[iconKeyValue.length - 2];

    let size = "16";
    element.attrs.forEach(attr => {
      if(attr.name.toLowerCase() === "size") {
        size = attr.value;
      }
    })

    const icon: IconMetadata = {
      name: ibmIconValue,
      size,
      path: replacementMap[element.tagName]
    };
    // Track back to module and add it to module

    const oldIconTag = new RegExp(`<${element.tagName}(.*?)`, 'g');
    let sourceText = srcTree.read(filePath)?.toString('utf-8') || '';

    sourceText = sourceText.replace(oldIconTag, (_, attributes) => {
      return `<svg ibmIcon="${ibmIconValue}"${attributes}`;
    });

    sourceText = sourceText.replace(new RegExp(`</${element.tagName}>`, 'g'), `</svg>`);
    srcTree.overwrite(filePath, sourceText);

    // console.log(`${element.tagName} replaced in ${filePath}`);
    findModuleForComponent(srcTree, filePath, modulePaths, icon);
  } else if (element.tagName === "div" || element.tagName === "svg") {  // Check the element attributes to see if the icon directive isn't used
    let size = "16";
    element.attrs.forEach(attr => {
      if(attr.name.toLowerCase() === "size") {
        size = attr.value;
      }
    })
    element.attrs.some((attr) => {
      // Directive found, replace
      if (replacementMap[attr.name.toLowerCase()]) {
        const iconKeyValue = (replacementMap[attr.name.toLowerCase()]).split('/');
        const ibmIconValue = iconKeyValue[iconKeyValue.length - 2];
        // Convert tag to svg + use ibmIcon directive.

        const icon: IconMetadata = {
          name: ibmIconValue,
          size: size,
          path: replacementMap[attr.name.toLowerCase()]
        };

        const oldIconTag = new RegExp(`${attr.name}`, 'gi');
        let sourceText = srcTree.read(filePath)?.toString('utf-8') || '';

        sourceText = sourceText.replace(oldIconTag, `ibmIcon="${ibmIconValue}"`);

        // sourceText = sourceText.replace(new RegExp(`</${element.tagName}>`, 'g'), `</svg>`);
        srcTree.overwrite(filePath, sourceText);

        // Track back to module and add it to module
        findModuleForComponent(srcTree, filePath, modulePaths, icon);
      }
    })
  }

  // Recursively go through all nodes & as long as it isn't text, replace!
  if (element.childNodes) {
    element.childNodes.forEach((child: any) => {
      if (child.nodeName !== '#text') {
        replaceHtmlTags(child, srcTree, filePath, modulePaths);
      }
    });
  }
}


function createModuleFileIfNotExist(dirTree: DirEntry, tree: Tree, sourceRoot: string) {
  let declarationFileExists = false;
  dirTree.visit(filePath => {
    if (filePath.endsWith('.d.ts')) {
      declarationFileExists = true;
      const fileBuffer = tree.read(filePath);
      if (fileBuffer) {
        let fileContent = fileBuffer.toString('utf-8');
        if (!fileContent.includes('@carbon/icons')) {
          fileContent += "\ndeclare module '@carbon/icons/*';\n";
          tree.overwrite(filePath, fileContent);
        }
      }
    }
  });

  if (!declarationFileExists) {
    tree.create(`${sourceRoot}/module.d.ts`, `\ndeclare module '@carbon/icons/*';\n`);
  }
}


// Rule entry
export function migrateIconPkg(options: any) {
  return async (tree: Tree) => {

    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get(options.project);

    // console.log('srcRoot is', project?.sourceRoot);
    if (project?.sourceRoot) {
      // Get directory to start searching for the templates in
      const srcTree = tree.getDir(project.sourceRoot);

      const moduleFilePaths = findModuleFiles(srcTree);

      // Create module file if it doesn't already exit
      createModuleFileIfNotExist(srcTree, tree, project.sourceRoot);

      // Modify all HTML files in the tree
      srcTree.visit(filePath => {
        // Check only component html files
        if (filePath.endsWith('component.html')) {
          const fileBuffer = tree.read(filePath);
          if (fileBuffer) {
            const fileContent = fileBuffer.toString('utf-8');

            // Parse the HTML using parse5
            const document = parseFragment(fileContent, { sourceCodeLocationInfo: true }) as Element;
            // Start parsing the template from root
            replaceHtmlTags(
              document,
              tree,
              filePath,
              moduleFilePaths
            );
          }
        }
      });
    }

    return tree;
  };
}
