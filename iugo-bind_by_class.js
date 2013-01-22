// ==ClosureCompiler==
// @compilation_level ADVANCED_OPTIMIZATIONS
// @output_file_name default.js
// @language ECMASCRIPT5
// ==/ClosureCompiler==

// Note on minification: the plugin name ("bind_by_class") can be replaced by an abbreviation ("VC"), post compile

/**
 * Author Chris Scott <chris.scott@factmint.com>
 * Delivered with and licensed under the MIT licence
 */
// Create a metadata store
$iugo['store']['bind_by_class'] = {
	tags: [],
	namespacedTagIndex: {}
};

// This initializer swaps ${var} for <spans> with attributes for use with the VC below
$iugo['initializers'].push(function(view) {
	var idCounter = 0;
	
	var innerHTMLRegex = /(>[^<$]*)\$\{([^:.}<]+:)?([^}<]*)\}([^<]*<)/g;
	// it is important to repeat the regex as it will only match one ${var} per tag innerHTML
	while (view.innerHTML.match(innerHTMLRegex)) {
		view.innerHTML = view.innerHTML.replace(innerHTMLRegex, function(m, before, namespace, address, after) {
			var replacement = before + '<span ';
			if (namespace) {
				replacement += 'class="bindto-' + namespace.substr(0, (namespace.length - 1)) + '" ';
			}
			replacement += 'data-bind_key="' + address + '"></span>' + after;
			
			return replacement;
		});
	}
	
	// First find tags that use a variable syntax in an attribute
	var tagRegex = /<[^>]+ [^ =]+="[^"]*\$\{[^}<"]+\}[^"]*"[^>]*>/g;
	view.innerHTML = view.innerHTML.replace(tagRegex, function(tag) {
		var tagId = idCounter++;
		
		$iugo['store']['bind_by_class'].tags[tagId] = {
			bindAttributes: [],
			attributeTemplates: {},
			replacements: {}
		};
		
		// Look for each attribute that uses a variable syntax...
		var attributeRegex = /([^ =]+)="([^"]*\$\{[^}"]+\}[^"]*)"/g;
		tag = tag.replace(attributeRegex, function(attribute, attributeName, attributeValue) {
			// add the attibute name to the bind attibute list (which will be processed at runtime)...
			$iugo['store']['bind_by_class'].tags[tagId].bindAttributes.push(attributeName);
			// and store the template used as the attibute value
			$iugo['store']['bind_by_class'].tags[tagId].attributeTemplates[attributeName] = attributeValue;
			
			// Check whether the value is namespaced
			var namespaceRegex = /\$\{([^"}:]+):[^}"]+\}/g;
			attributeValue.replace(namespaceRegex, function(m, namespace) {
				// Create a metadata store for the property
				if (!$iugo['store']['bind_by_class'].namespacedTagIndex[namespace]) {
					$iugo['store']['bind_by_class'].namespacedTagIndex[namespace] = [];
				}
				// Record that changes to the namespace will need to recompile this tag
				if ($iugo['store']['bind_by_class'].namespacedTagIndex[namespace].indexOf(tagId) == -1) {
					$iugo['store']['bind_by_class'].namespacedTagIndex[namespace].push(tagId);
				}
			});
			
			// finally, return an empty value for the attribute
			return attributeName + '=""';
		});
		
		tag = tag.replace(/ ?>$/, ' data-iugo_id="' + tagId + '">');
		return tag;
	});
});
// This VC binds values to the DOM tree, when a class "bindto-property" is applied
$iugo['defaultViewcontrollers'].push(function(property, value, view, path) {
	var attributeRegex = /\$\{([^:}]+:)?([^}]+)\}/g;
	
	function compileTagAttributes(tagId) {
		var tag = document.querySelector('[data-iugo_id="' + tagId + '"]');
		
		var attributes = $iugo['store']['bind_by_class'].tags[tagId].bindAttributes;
		
		for (var x = 0; x < attributes.length; x++) {
			var template = $iugo['store']['bind_by_class'].tags[tagId].attributeTemplates[attributes[x]];
			
			var compiledAttribute = template.replace(attributeRegex, function(match) {
				return ($iugo['store']['bind_by_class'].tags[tagId].replacements[match]) ?
					$iugo['store']['bind_by_class'].tags[tagId].replacements[match] :
					"";
			});
			
			tag.setAttribute(attributes[x], compiledAttribute);
		}
	}
	
	function updateTagReplacements(value, view, scope) {
		if (view.hasAttribute('data-iugo_id')) {
			var tagId = view.getAttribute('data-iugo_id');
			
			var attributes = $iugo['store']['bind_by_class'].tags[tagId].bindAttributes;
			for (var x = 0; x < attributes.length; x++) {
				var attribute = attributes[x];
				
				// Add the variables to the store with their latest values
				var template = $iugo['store']['bind_by_class'].tags[tagId].attributeTemplates[attribute];
				template.replace(attributeRegex, function(match, namespace, address) {			
					if ((!namespace && !scope) || (namespace && namespace.substr(0, namespace.length - 1) == scope)) {
						var source = address.split('.');
						var workingValue = value;
						for (var x = 0; x < source.length; x++) {
							workingValue = workingValue[source[x]];
						}
						$iugo['store']['bind_by_class'].tags[tagId].replacements[match] = workingValue;
					}
				});
				
			}
			
			compileTagAttributes(tagId);
		}
	}
	
	/**
	 * Recursively scan the given view looking for replacements to variables and
	 * marked tag's innerHTML.
	 * 
	 * The path argument tracks the deep recursion and is used to fill relative addresses
	 */
	function process(value, view, path) {
		// Update the replacements for a tag marked with an iugo_id
		updateTagReplacements(value, view);
		
		// Recurse the DOM looking for substitutions
		if (value instanceof Array) {
			var numberOfChildren = view.children.length;
			for (var x = numberOfChildren - 1; x >= 0; x--) {
				if (view.children[x].classList.contains('iugo_cloned')) {
					view.removeChild(view.children[x]);
				}
			}
			numberOfChildren = view.children.length;
			for (var x = 0; x < numberOfChildren; x++) {
				var elementView;
				if (view.children[x].hasAttribute('data-bind_each')) {
					elementView = view.children[x];
				} else {
					continue;
				}
				
				if (value.length == 0) {
					elementView.setAttribute("data-iugo_display", elementView.style.display);
					elementView.style.display = "none";
				} else {
					elementView.style.display = elementView.getAttribute("data-iugo_display");
				}
				
				for (var y = 0; y < value.length; y++) {
					var duplicateElement;
					if (y >= 1) {
						duplicateElement = elementView.cloneNode(true);
						duplicateElement.classList.add("iugo_cloned");
						view.appendChild(duplicateElement);
					} else {
						duplicateElement = elementView;
					}
					process(value[y], duplicateElement);
				}
			}
		} else if (value instanceof Object) {
			var attribute = view.getAttribute('data-bind_key');
			if (attribute != null && attribute != "") {
				if (path == null) {
					path = "";
				} else {
					path += ".";
				}
				var nextPath = attribute.slice(path.length).split('.')[0];
				
				process(value[nextPath], view, path + nextPath);
			}
			for (var x = 0; x < view.children.length; x++) {
				// it is possible to use a bindto-XXX class in a sub-element of an already bound element
				// in that case we want to skip the DOM descent from the parent and wait until the child has its own binding iteration
				if (! view.children[x].className.match("bindto-")) {
					process(value, view.children[x], path);
				}
			}
		} else {
			if (view.tagName == "INPUT") {
				view.value = value;
			} else {
				view.innerHTML = value;
			}
		}
	}
	
	// Look for elements with a generated iugo id for processing
	if ($iugo['store']['bind_by_class'].namespacedTagIndex[property]) {
		var idList = $iugo['store']['bind_by_class'].namespacedTagIndex[property];
		for (var x = 0; x < idList.length; x++) {
			var elements = view.querySelectorAll('[data-iugo_id="' + idList[x] + '"]');
			
			for (var y = 0; y < elements.length; y++ ) {
				// Update the replacements for a tag marked with an iugo_id
				updateTagReplacements(value, elements[y], property);
			}
		}
	}
	
	// Look for elements with a bindto-XXX class for processing
	var elements = view.getElementsByClassName("bindto-" + property);
	for (var x = 0; x < elements.length; x++ ) {
		process(value, elements[x]);
	}
});