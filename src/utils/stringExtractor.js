class StringExtractor {
  constructor() {
    this.extractedStrings = new Map();
    this.keyCounter = new Map();
  }

  // Check if string should be excluded from translation
  shouldExcludeString(text, context = {}) {
    const cleanText = text.trim();
    
    // Exclude empty strings
    if (!cleanText) return true;
    
    // Exclude very short strings (< 2 chars) unless they're meaningful
    if (cleanText.length < 2) return true;
    
    // Exclude numbers only
    if (/^\d+$/.test(cleanText)) return true;
    
    // Exclude URLs
    if (/^https?:\/\//.test(cleanText)) return true;
    
    // Exclude CSS classes and technical content
    if (this.isCodeString(cleanText)) return true;
    
    // Exclude file paths
    if (/\//.test(cleanText) && !cleanText.includes(' ')) return true;
    
    // Exclude existing translation keys
    if (/^[a-z0-9._-]+$/i.test(cleanText) && cleanText.includes('.')) return true;
    
    // Exclude email addresses
    if (/@/.test(cleanText) && !cleanText.includes(' ')) return true;
    
    return false;
  }

  // Check if text is technical/code content that shouldn't be translated
  isCodeString(text) {
    if (!text || typeof text !== 'string') return false;
    
    const cleanText = text.trim();
    
    // Common code patterns
    const codePatterns = [
      /^[a-zA-Z_$][a-zA-Z0-9_$]*$/, // Variable names
      /^[A-Z_][A-Z0-9_]*$/, // Constants
      /\.(js|ts|jsx|tsx|css|scss|html|json)$/, // File extensions
      /^#[0-9a-fA-F]{3,6}$/, // Hex colors
      /^\d+px$|^\d+rem$|^\d+em$|^\d+%$/, // CSS units
      /^rgb\(|^rgba\(|^hsl\(|^hsla\(/, // CSS color functions
      /^[a-z-]+:[a-z-]+$/, // CSS properties like "background-color"
      /^\.[\w-]+$|^#[\w-]+$/, // CSS selectors
      /^@[\w-]+/, // CSS at-rules
      /^\$[\w-]+/, // SCSS variables
      /^--[\w-]+/, // CSS custom properties
      /^\{.*\}$/, // JSON-like objects
      /^\[.*\]$/, // Arrays
      /^<\w+/, // HTML tags
      /^\/\w+/, // Paths
      /^https?:\/\//, // URLs
      /^\w+\(\)$/, // Function calls
      /^\w+\.\w+/, // Property access
      /^import\s|^export\s|^function\s|^class\s|^const\s|^let\s|^var\s/, // JS keywords
      /displayName|forwardRef|React\.|\.displayName/, // React patterns
      /className|tailwind|css-/, // CSS/styling patterns
      /^[a-z-_]+$/i, // Single words that might be CSS classes
    ];
    
    // Check for Tailwind/CSS class patterns
    const tailwindPatterns = [
      /^(bg|text|border|p|m|w|h|flex|grid|absolute|relative|fixed|static|sticky)-/, // Tailwind prefixes
      /^(sm|md|lg|xl|2xl):/, // Responsive prefixes
      /^(hover|focus|active|disabled|first|last|odd|even):/, // State prefixes
      /^group-/, // Group utilities
      /^space-/, // Space utilities
      /^divide-/, // Divide utilities
    ];
    
    return codePatterns.some(pattern => pattern.test(cleanText)) ||
           tailwindPatterns.some(pattern => pattern.test(cleanText)) ||
           cleanText.includes('displayName') ||
           cleanText.includes('forwardRef') ||
           cleanText.includes('React.') ||
           cleanText.includes('className') ||
           cleanText.includes('px-') ||
           cleanText.includes('py-') ||
           cleanText.includes('bg-') ||
           cleanText.includes('text-') ||
           cleanText.includes('border-') ||
           cleanText.includes('flex') ||
           cleanText.includes('grid') ||
           cleanText.includes('transition-') ||
           cleanText.includes('duration-') ||
           cleanText.includes('ease-') ||
           cleanText.includes('group-data') ||
           cleanText.includes('peer-data');
  }

  // Classify string as user-facing text or technical content
  classifyStringType(text, context = {}) {
    if (this.isCodeString(text)) {
      return 'code';
    }
    
    // Check if it's likely user-facing text
    const hasSpaces = text.includes(' ');
    const hasCommonWords = /\b(the|and|or|of|to|in|for|with|on|at|by|from|up|about|into|over|after)\b/i.test(text);
    const isPunctuation = /[.!?,:;]/.test(text);
    const isCapitalized = /^[A-Z]/.test(text.trim());
    
    if (hasSpaces && (hasCommonWords || isPunctuation || isCapitalized)) {
      return 'ui-text';
    }
    
    // Check for specific UI contexts
    if (context.attribute && ['placeholder', 'title', 'alt', 'aria-label'].includes(context.attribute)) {
      return 'ui-text';
    }
    
    if (context.type === 'button' || context.type === 'label' || context.type === 'heading') {
      return 'ui-text';
    }
    
    return 'technical';
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

    // Basic context classification without babel types
    if (attributeName) {
      if (['placeholder', 'title', 'alt', 'aria-label'].includes(attributeName)) {
        context.type = attributeName === 'placeholder' ? 'placeholder' : 'attribute';
      }
    }

    return context;
  }

  // Extract strings from JSX/React components using regex (fallback)
  extractFromReactFile(content, filePath) {
    const strings = [];
    const seenStrings = new Map(); // Track unique strings per file
    
    const addUniqueString = (text, context, key, stringType) => {
      const uniqueKey = `${text}`;
      if (seenStrings.has(uniqueKey)) {
        // Merge contexts if string already exists
        const existing = seenStrings.get(uniqueKey);
        existing.contexts = existing.contexts || [existing.context];
        existing.contexts.push(context);
        console.log(`Duplicate string detected in ${filePath}: "${text}" - merging contexts`);
      } else {
        const stringData = {
          key,
          text,
          context,
          location: { line: 0, column: 0 },
          filePath,
          type: stringType, // Add type classification
        };
        seenStrings.set(uniqueKey, stringData);
        strings.push(stringData);
      }
    };
    
    try {
      // Extract JSX text content
      const jsxTextRegex = />([^<>{}]+)</g;
      let match;
      while ((match = jsxTextRegex.exec(content)) !== null) {
        const text = match[1].trim();
        if (!this.shouldExcludeString(text)) {
          const context = this.classifyContext(null, null);
          const stringType = this.classifyStringType(text, context);
          
          // Only include user-facing text
          if (stringType === 'ui-text') {
            const key = this.generateKey(text, context, filePath);
            addUniqueString(text, context, key, stringType);
          }
        }
      }

      // Extract string attributes
      const attrRegex = /(placeholder|title|alt|aria-label)=['"]([^'"]+)['"]/g;
      while ((match = attrRegex.exec(content)) !== null) {
        const attributeName = match[1];
        const text = match[2];
        
        if (!this.shouldExcludeString(text)) {
          const context = this.classifyContext(null, attributeName);
          const stringType = this.classifyStringType(text, context);
          
          // Only include user-facing text
          if (stringType === 'ui-text') {
            const key = this.generateKey(text, context, filePath);
            addUniqueString(text, { ...context, attribute: attributeName }, key, stringType);
          }
        }
      }

      // Extract string literals that appear to be UI text
      const stringLiteralRegex = /(['"`])([^'"`\n]{3,})\1/g;
      while ((match = stringLiteralRegex.exec(content)) !== null) {
        const text = match[2];
        
        if (!this.shouldExcludeString(text) && text.length > 3) {
          const context = this.classifyContext(null, null);
          const stringType = this.classifyStringType(text, context);
          
          // Check if it's likely UI text
          const uiKeywords = ['error', 'success', 'warning', 'info', 'loading', 'save', 'cancel', 'submit', 'delete', 'edit', 'add', 'remove'];
          const isLikelyUIText = text.includes(' ') || 
                                 uiKeywords.some(keyword => text.toLowerCase().includes(keyword));
          
          if (isLikelyUIText && stringType === 'ui-text') {
            const key = this.generateKey(text, context, filePath);
            addUniqueString(text, context, key, stringType);
          }
        }
      }
    } catch (error) {
      console.warn(`Error parsing ${filePath}:`, error.message);
    }

    console.log(`Extracted ${strings.length} unique UI strings from ${filePath}`);
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
            const stringType = this.classifyStringType(text, { type: 'text' });
            if (stringType === 'ui-text') {
              const key = this.generateKey(text, { type: 'text' }, filePath);
              strings.push({
                key,
                text,
                context: { type: 'text' },
                filePath,
                type: stringType,
              });
            }
          }
        }
        
        // Extract attributes
        const attrRegex = /(placeholder|title|alt|aria-label)=['"]([^'"]+)['"]/g;
        while ((match = attrRegex.exec(templateContent)) !== null) {
          const attributeName = match[1];
          const text = match[2];
          if (!this.shouldExcludeString(text)) {
            const context = { type: 'attribute', attribute: attributeName };
            const stringType = this.classifyStringType(text, context);
            if (stringType === 'ui-text') {
              const key = this.generateKey(text, context, filePath);
              strings.push({
                key,
                text,
                context,
                filePath,
                type: stringType,
              });
            }
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

export { StringExtractor };
export default StringExtractor;
