/* (C) Stefan John / Stenway / SimpleML.com / 2021 */

"use strict";

class SmlDocument {
	constructor(root) {
		this.root = root;
		this.defaultIndentation = null;
		this.endKeyword = "End";
	}
	
	setDefaultIndentation(defaultIndentation) {
		this.defaultIndentation = defaultIndentation;
	}
	
	getDefaultIndentation() {
		return this.defaultIndentation;
	}
	
	setEndKeyword(endKeyword) {
		this.endKeyword = endKeyword;
	}
	
	getEndKeyword() {
		return this.endKeyword;
	}
}

class SmlNode {
	
	isElement() {
		return this instanceof SmlElement;
	}
	
	isAttribute() {
		return this instanceof SmlAttribute;
	}
}

class SmlNamedNode extends SmlNode {
	constructor(name) {
		super();
		this.name = name;
	}
	
	hasName(name) {
		return SmlUtils.equalsIgnoreCase(this.name, name);
	}
	
	isElementWithName(name) {
		if (!(this instanceof SmlElement)) return false;
		return this.hasName(name);
	}
	
	isAttributeWithName(name) {
		if (!(this instanceof SmlAttribute)) return false;
		return this.hasName(name);
	}
}

class SmlElement extends SmlNamedNode {
	constructor(name) {
		super(name);
		this.nodes = [];
	}
	
	add(node) {
		this.nodes.push(node);
	}
	
	hasElement(name) {
		return this.nodes.find(node => node.isElementWithName(name)) != undefined;
	}
	
	element(name) {
		return this.nodes.find(node => node.isElementWithName(name));
	}
	
	elements(name) {
		return this.nodes.filter(node => node.isElementWithName(name));
	}
	
	hasAttribute(name) {
		return this.nodes.find(node => node.isAttributeWithName(name)) != undefined;
	}
	
	attribute(name) {
		return this.nodes.find(node => node.isAttributeWithName(name));
	}
	
	attributes(name) {
		return this.nodes.filter(node => node.isAttributeWithName(name));
	}
	
	addAttribute(name, values) {
		this.add(new SmlAttribute(name, values));
	}
	
	addString(name, value) {
		var strValue = value;
		if (value != null && typeof(value) != "string") {
			strValue = String(value);
		}
		this.addAttribute(name, [strValue]);
	}
	
	addElement(name) {
		var element = new SmlElement(name);
		this.add(element);
		return element;
	}
}

class SmlAttribute extends SmlNamedNode {
	constructor(name, values) {
		super(name);
		if (!Array.isArray(values)) throw new Error("Values of attribute '"+name+"' not an array");
		if (values.length == 0) throw new Error("Attribute '"+name+"'must contain at least one value");
		this.values = values;
	}
	
	getString() {
		return this.values[0];
	}
	
	/*set values(valueArray) {
		__values
	}*/
}

class SmlError extends Error {
	constructor(message) {
		super(message);
		this.name = "SmlError";
	}
}

class BasicSmlParserError extends Error {
	constructor(lineIndex, message) {
		super(`${message} (${lineIndex+1})`);
		this.name = "BasicSmlParserError";
		this.lineIndex = lineIndex;
	}
}

class BasicWsvLineIterator {
	constructor(content) {
		this.lines = BasicWsvParser.parseDocument(content);	
		this.index = 0;
		this.__detectEndKeyword();
	}
	
	getEndKeyword() {
		return this.endKeyword;
	}
	
	hasLine() {
		return this.index < this.lines.length;
	}

	isEmptyLine() {
		return this.hasLine() && (this.lines[this.index] == null || this.lines[this.index].length == 0);
	}

	getLine() {
		var line = this.lines[this.index];
		this.index++;
		return line;
	}
	
	__detectEndKeyword() {
		var i;
		for (i=this.lines.length-1; i>=0; i--) {
			var values = this.lines[i];
			if (values.length == 1) {
				this.endKeyword = values[0];
				return;
			} else if (values.length > 1) {
				break;
			}
		}
		throw new BasicSmlParserError(this.lines.length-1, "End keyword could not be detected");
	}

	getException(message) {
		return new BasicSmlParserError(this.index, message);
	}
	
	getLastLineException(message) {
		return new BasicSmlParserError(this.index-1, message);
	}
}

class SmlUtils {
	static equalsIgnoreCase(str1, str2) {
		return typeof str1 === 'string' && typeof str2 === 'string' ?
			str1.localeCompare(str2, undefined, {sensitivity: 'accent' }) === 0 
			: str1 === str2;
	}
}

class BasicSmlParser {
	static parseDocument(content) {
		var iterator = new BasicWsvLineIterator(content);
		
		this.__skipEmptyLines(iterator);
		if (!iterator.hasLine()) {
			throw iterator.getException("Root element expected");
		}
		
		var node = this.__readNode(iterator);
		if (!(node instanceof SmlElement)) {
			throw iterator.getLastLineException("Invalid root element start");
		}
		
		this.__skipEmptyLines(iterator);
		if (iterator.hasLine()) {
			throw iterator.getException("Only one root element allowed");
		}
		
		var document = new SmlDocument(node);
		document.setEndKeyword(iterator.getEndKeyword());
		return document;
	}
	
	static __skipEmptyLines(iterator) {
		while (iterator.isEmptyLine()) {
			iterator.getLine();
		}
	}
	
	static __readNode(iterator) {
		var line = iterator.getLine();
		
		var name = line[0];
		if (SmlUtils.equalsIgnoreCase(name, iterator.getEndKeyword())) {
			if (line.length == 1) {
				return null;
			}
			
		}
		if (line.length == 1) {
			if (name == null) {
				throw iterator.getLastLineException("Null value as element name is not allowed");
			}
			var element = new SmlElement(name);
			this.__readElementContent(iterator, element);
			return element;
		} else {
			if (name == null) {
				throw iterator.getLastLineException("Null value as attribute name is not allowed");
			}
			var values = line.slice(1);
			var attribute = new SmlAttribute(name, values);
			return attribute;
		}
	}
	
	static __readElementContent(iterator, element) {
		while (true) {
			if (!iterator.hasLine()) {
				throw iterator.getLastLineException("Element \""+element.name+"\" not closed");
			}
			this.__skipEmptyLines(iterator);
			var node = this.__readNode(iterator);
			if (node == null) {
				break;
			}
			element.add(node);
		}
	}
}

class BasicSmlSerializer {
	static serializeDocument(document) {
		var result = "";
		var defaultIndentation = document.getDefaultIndentation();
		if (defaultIndentation == null) {
			defaultIndentation = "\t";
		}
		result = this.__serializeElement(document.root, 0, defaultIndentation, document.getEndKeyword());
		return result.slice(0, -1);
	}

	static __serializeElement(element, level, defaultIndentation, endKeyword) {
		var result = "";
		result += this.__serializeIndentation(level, defaultIndentation);
		result += BasicWsvSerializer.serializeValue(element.name);
		result += '\n'; 

		var childLevel = level + 1;
		for (var child of element.nodes) {
			if (child instanceof SmlElement) {
				result += this.__serializeElement(child, childLevel, defaultIndentation, endKeyword);
			} else if (child instanceof SmlAttribute) {
				result += this.__serializeAttribute(child, childLevel, defaultIndentation);
			}
		}
		
		result += this.__serializeIndentation(level, defaultIndentation);
		result += BasicWsvSerializer.serializeValue(endKeyword);
		result += '\n';
		return result;
	}
	
	static __serializeAttribute(attribute, level, defaultIndentation) {
		var result = "";
		result += this.__serializeIndentation(level, defaultIndentation);
		result += BasicWsvSerializer.serializeValue(attribute.name);
		result += ' '; 
		result += BasicWsvSerializer.serializeLine(attribute.values);
		result += '\n';
		return result;
	}
	
	static __serializeIndentation(level, defaultIndentation) {
		return defaultIndentation.repeat(level);
	}
}