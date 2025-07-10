import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export class StringExtractor {
  constructor() {
    this.extractedStrings = new Map();
    this.keyCounter = new Map();
  }

  // Generate a semantic key based on context
  generateKey(text, context, filePath) {
    const cleanText = text.trim().toLowerCase();
    const fileName = filePath.split('/').pop()?.split('.')[0] || 'unknown';
    
    // Generate semantic key based on context
    let baseKey = '';
    
    switch (context.type) {
      case 'button':
        baseKey = `button.${cleanText.replace(/[^a-z0-9]/g, '_')}`;
        break;
      case 'placeholder':
        baseKey = `form.placeholder.${cleanText.replace(/[^a-z0-9]/g, '_')}`;
        break;
      case 'title':
      case 'heading':
        baseKey = `title.${cleanText.replace(/[^a-z0-9]/g, '_')}`;
        break;
      case 'label':
        baseKey = `label.${cleanText.replace(/[^a-z0-9]/g, '_')}`;
        break;
      case 'error':
        baseKey = `error.${cleanText.replace(/[^a-z0-9]/g, '_')}`;
        break;
      default:
        baseKey = `${fileName}.${cleanText.replace(/[^a-z0-9]/g, '_')}`;
    }

    // Ensure unique key
    const counter = this.keyCounter.get(baseKey) || 0;
    this.keyCounter.set(baseKey, counter + 1);
    
    return counter > 0 ? `${baseKey}_${counter}` : baseKey;
  }

  // Classify string context based on JSX context
  classifyContext(path, attributeName) {
    const context = { type: 'text', element: null, attribute: attributeName };

    if (t.isJSXElement(path.parent) || t.isJSXFragment(path.parent)) {
      const tagName = t.isJSXElement(path.parent) ? path.parent.openingElement.name.name : 'fragment';
      context.element = tagName;

      // Classify based on element type
      if (['button', 'submit'].includes(tagName?.toLowerCase())) {
        context.type = 'button';
      } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title'].includes(tagName?.toLowerCase())) {
        context.type = 'heading';
      } else if (tagName?.toLowerCase() === 'label') {
        context.type = 'label';
      }
    }

    if (attributeName) {
      if (['placeholder', 'title', 'alt', 'aria-label'].includes(attributeName)) {
        context.type = attributeName === 'placeholder' ? 'placeholder' : 'attribute';
      }
    }

    return context;
  }

  // Check if string should be excluded from translation
  shouldExcludeString(text, context) {
    const cleanText = text.trim();
    
    // Exclude empty strings
    if (!cleanText) return true;
    
    // Exclude very short strings (< 2 chars) unless they're meaningful
    if (cleanText.length < 2) return true;
    
    // Exclude numbers only
    if (/^\d+$/.test(cleanText)) return true;
    
    // Exclude URLs
    if (/^https?:\/\//.test(cleanText)) return true;
    
    // Exclude CSS classes and IDs
    if (/^[a-z-_]+$/i.test(cleanText) && cleanText.includes('-')) return true;
    
    // Exclude file paths
    if (/\//.test(cleanText) && !cleanText.includes(' ')) return true;
    
    // Exclude existing translation keys
    if (/^[a-z0-9._-]+$/i.test(cleanText) && cleanText.includes('.')) return true;
    
    // Exclude email addresses
    if /@/.test(cleanText) && !cleanText.includes(' ')) return true;
    
    return false;
  }

  // Extract strings from JSX/React components using Babel AST
  extractFromReactFile(content, filePath) {
    const strings = [];
    
    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true,
      });

      traverse(ast, {
        // Extract text content from JSX elements
        JSXText(path) {
          const text = path.node.value.trim();
          if (!this.shouldExcludeString(text)) {
            const context = this.classifyContext(path);
            const key = this.generateKey(text, context, filePath);
            
            strings.push({
              key,
              text,
              context,
              location: {
                line: path.node.loc?.start.line,
                column: path.node.loc?.start.column,
              },
              filePath,
            });
          }
        },

        // Extract string attributes from JSX elements
        JSXAttribute(path) {
          if (t.isStringLiteral(path.node.value)) {
            const attributeName = path.node.name.name;
            const text = path.node.value.value;
            
            if (!this.shouldExcludeString(text) && 
                ['placeholder', 'title', 'alt', 'aria-label', 'aria-description'].includes(attributeName)) {
              const context = this.classifyContext(path, attributeName);
              const key = this.generateKey(text, context, filePath);
              
              strings.push({
                key,
                text,
                context: { ...context, attribute: attributeName },
                location: {
                  line: path.node.loc?.start.line,
                  column: path.node.loc?.start.column,
                },
                filePath,
              });
            }
          }
        },

        // Extract string literals that appear to be UI text
        StringLiteral(path) {
          const text = path.node.value;
          
          // Only extract if it's not already captured as JSX and looks like UI text
          if (!this.shouldExcludeString(text) && 
              text.length > 3 && 
              /[a-zA-Z]/.test(text) &&
              !t.isJSXAttribute(path.parent)) {
            
            // Check if it's likely UI text (contains spaces or common UI words)
            const uiKeywords = ['error', 'success', 'warning', 'info', 'loading', 'save', 'cancel', 'submit', 'delete', 'edit', 'add', 'remove'];
            const isLikelyUIText = text.includes(' ') || 
                                   uiKeywords.some(keyword => text.toLowerCase().includes(keyword));
            
            if (isLikelyUIText) {
              const context = this.classifyContext(path);
              const key = this.generateKey(text, context, filePath);
              
              strings.push({
                key,
                text,
                context,
                location: {
                  line: path.node.loc?.start.line,
                  column: path.node.loc?.start.column,
                },
                filePath,
              });
            }
          }
        },

        // Extract template literals with UI text
        TemplateLiteral(path) {
          // Simple template literals without expressions
          if (path.node.expressions.length === 0 && path.node.quasis.length === 1) {
            const text = path.node.quasis[0].value.cooked;
            
            if (!this.shouldExcludeString(text) && text.length > 3) {
              const context = this.classifyContext(path);
              const key = this.generateKey(text, context, filePath);
              
              strings.push({
                key,
                text,
                context,
                location: {
                  line: path.node.loc?.start.line,
                  column: path.node.loc?.start.column,
                },
                filePath,
              });
            }
          }
        },
      });
    } catch (error) {
      console.warn(`Error parsing ${filePath}:`, error.message);
    }

    return strings;
  }

  // Extract strings from Vue files
  extractFromVueFile(content, filePath) {
    const strings = [];
    
    try {
      // Extract from template section
      const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
      if (templateMatch) {
        const templateContent = templateMatch[1];
        
        // Extract text content
        const textRegex = />([^<>{}]+)</g;
        let match;
        while ((match = textRegex.exec(templateContent)) !== null) {
          const text = match[1].trim();
          if (!this.shouldExcludeString(text)) {
            const key = this.generateKey(text, { type: 'text' }, filePath);
            strings.push({
              key,
              text,
              context: { type: 'text' },
              filePath,
            });
          }
        }
        
        // Extract attributes
        const attrRegex = /(placeholder|title|alt|aria-label)=['"]([^'"]+)['"]/g;
        while ((match = attrRegex.exec(templateContent)) !== null) {
          const attributeName = match[1];
          const text = match[2];
          if (!this.shouldExcludeString(text)) {
            const key = this.generateKey(text, { type: 'attribute', attribute: attributeName }, filePath);
            strings.push({
              key,
              text,
              context: { type: 'attribute', attribute: attributeName },
              filePath,
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Error parsing Vue file ${filePath}:`, error.message);
    }

    return strings;
  }

  // Main extraction method
  extractStrings(content, filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
      return this.extractFromReactFile(content, filePath);
    } else if (ext === 'vue') {
      return this.extractFromVueFile(content, filePath);
    }
    
    return [];
  }

  // Process multiple files and return consolidated results
  processFiles(files) {
    const allStrings = [];
    const keyMap = new Map();
    
    files.forEach(({ filePath, content }) => {
      const strings = this.extractStrings(content, filePath);
      strings.forEach(stringData => {
        // Check for duplicate keys and handle conflicts
        if (keyMap.has(stringData.key)) {
          const existing = keyMap.get(stringData.key);
          if (existing.text !== stringData.text) {
            // Generate new unique key for conflict
            stringData.key = `${stringData.key}_${filePath.replace(/[^a-z0-9]/gi, '_')}`;
          }
        }
        
        keyMap.set(stringData.key, stringData);
        allStrings.push(stringData);
      });
    });
    
    return {
      strings: allStrings,
      keyMap: Object.fromEntries(keyMap),
      totalStrings: allStrings.length,
    };
  }
}

export default StringExtractor;