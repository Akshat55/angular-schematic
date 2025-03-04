import * as ts from 'typescript';

// Check if `path` exists in source file
export function isIconPathAlreadyImported(source: ts.SourceFile, path: string): boolean {
    // Loop through all top-level statements in the source file
    return source.statements.some((statement) => {
        // Check if the statement is an import declaration
        if (ts.isImportDeclaration(statement)) {
            const moduleSpecifier = statement.moduleSpecifier;

            // The moduleSpecifier is a string literal (the path of the import)
            if (ts.isStringLiteral(moduleSpecifier)) {
                if (moduleSpecifier.text.toLowerCase() === path.toLowerCase()) {
                    return true;
                }
            }
        }
        return false;
    });
}



// Find position to insert after the last import declaration (or at the top if none exist)
export function insertDefaultImport(source: ts.SourceFile, importPath: string) {
    let lastImportEndPosition = 0;

    // Loop through the statements to find the last import declaration
    source.statements.forEach(statement => {
        if (ts.isImportDeclaration(statement)) {
            lastImportEndPosition = statement.end;
        }
    });

    // We want the import statement to be inserted on a new line and end with a new line
    const importStatement = `\n${importPath}`;

    return {
        fileName: source.fileName,
        position: lastImportEndPosition,
        importStatement
    };
}



// Utility function to find an import declaration by module name
export function findImportDeclaration(source: ts.SourceFile, moduleName: string): ts.ImportDeclaration | undefined {
    return source.statements.find(
        (statement): statement is ts.ImportDeclaration =>
            ts.isImportDeclaration(statement) &&
            statement.moduleSpecifier.getText(source) === `'${moduleName}'`
    );
}



// Recursively traverse the AST Node and find for `ArrayLiteralExpression`
export function findArrayLiteralExpression(node: ts.Node): ts.Expression[] {
    // Check if the current node is an ArrayLiteralExpression
    if (ts.isArrayLiteralExpression(node)) {
        // Print each element in the array
        return node.elements.map(element => element);
    }

    let result: ts.Expression[] = [];
    node.forEachChild(child => {
        const childResult = findArrayLiteralExpression(child);
        if (childResult?.length > 0) {
            result = childResult;
        }
    })

    return result;
}
