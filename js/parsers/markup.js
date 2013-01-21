

var LocalParser = $.uix.synthed.Parser = new (function() {
    var handlers = [];

    this.parse = function(context, text) {
        $.each(handlers, function(i,handler) {
            try {
                var value = handler.call(context, text);

                if (value) {
                    text = value;
                }
            } catch (e) { /* ignore errors */ }
        });

        return text;
    };

    /**
     * Register a new parsing handler
     *
     * @param index numeric (optional) where the new handler should be registered
     * @param handler function         the handler function (will receive the text as string and
     *                                 should return the parsed text as string or false)
     */
    this.registerHandler = function(index, handler) {
        if (arguments.length == 1) {
            handler = index;
            index = undefined;
        }

        if ($.inArray(handler, handlers) != -1) return;

        if (index && (index < handlers.length)) {
            handlers.splice(index, 0, handler);
        } else {
            handlers.push(handler);
        }
    };

})();




// REMVOE TAGS
LocalParser.registerHandler((function() {
    var regexp = /(<(([^"'>]+["']([^"'\\]*(\\.)*)*["']\s*)+|[^>]+)>)/g;
    return function(text) {
        return text.replace(regexp, function() {
            return "";
        });
    };
})());

// REPLACE HTML ENTITIES
LocalParser.registerHandler((function() {
    var table = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
    };
    var keys = "[" + $.map(table, function(e,k) { return '\\'+k; }).join('') + "]";
    var regExp = new RegExp(keys, 'g');
    return function(text) {
        return text.replace(regExp, function() {
            return table[arguments[0]] || '';
        });
    };
})());


// WORD SPACING
/*
LocalParser.registerHandler((function() {
    var regExp = new RegExp("(<p>)(?:\n?)([\\s]{1,})", 'gmi');
    return function(text) {
        return text.replace(regExp, function(m,g1,g2) {
            console.log(arguments);
            return g1 + (new Array(g2.length).join("&nbsp;"));
        });
    };
})());
*/


// BOLD
LocalParser.registerHandler((function() {
    var regExp = /\*(.*?)\*/g;
    return function(text) {
        return text.replace(regExp, function() {
            return '<strong>' + arguments[1] + '</strong>';
        });
    };
})());

// HEADER
LocalParser.registerHandler((function() {
    var table = {
        '=': 'h1',
        '-': 'h2'
    };
    var regExp = /([^\n]+)\n(=+|-+)/g;
    return function(text) {
        return text.replace(regExp, function() {
            var tag = table[arguments[2].charAt(0)];
            return '<'+tag+'>' + arguments[1] + '</'+tag+'>';
        });
    };
})());

// PARAGRAPHS
LocalParser.registerHandler((function() {
    var regExp = /(\n{2})/g;
    return function(text) {
        var open = $.uix.synthed.GlobalOptions.paragraphStart;
        var close = $.uix.synthed.GlobalOptions.paragraphEnd;
        return open + text.replace(regExp, function() {
            return close + open;
        }) + close;
    };
})());
