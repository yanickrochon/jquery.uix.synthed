/*
 * jQuery UIx Synthed
 *
 * Authors:
 *  Yanick Rochon (yanick.rochon[at]gmail[dot]com)
 *
 * Licensed under the MIT (MIT-LICENSE.txt) license.
 *
 * http://mind2soft.com/labs/jquery/synthed/
 *
 *
 * Depends:
 * jQuery UI 1.9+
 *
 */

(function($) {

var WIDGET_CSS_CLASS = 'ui-widget ui-widget-content uix-synthed-content';
var WIDGET_TEXTAREA_EVENTS = "change propertychange textinput input cut delete drop paste redo undo".split(" ");
var WIDGET_EVENT_NAMESPACE = '.uix-synthed';
var WIDGET_EVENT_BEFORE_PARSE = 'synthedbeforeparse';
var WIDGET_EVENT_AFTER_PARSE = 'synthedparsed';
var WIDGET_DEFAULT_FONT = '"Courier New", monospace';


// prepare all event bindings
var WIDGET_EVENT_BINDINGS = $.map(WIDGET_TEXTAREA_EVENTS, function(e) { return e + WIDGET_EVENT_NAMESPACE; }).join(' ');


// The jQuery.uix namespace will automatically be created if it doesn't exist
$.widget("uix.synthed", {
    options: {
        fontFamily: WIDGET_DEFAULT_FONT, // string; the editor's font (default: '"Courier New", monospace')
        height: null,                    // int; the editor height. If null, uses already defined width (default: null)
        width: null,                     // int; the editor width. If null, uses already defined width (default: null)
        parser: '',                      // string; the parser to use when converting the text inside the textarea (default: '')
        toolbarElement: null,            // string, Element; the element that will be used to render the toolbar
        toolbar: null,                   // string; the toolbar to use (see $.uix.synthed.Toolbars). Will create new element
                                         //         before textarea if toolbarElement is null and toolbar is not null. (default: null)
        updateElement: null,             // string, Element; the element to update after text parsed event (default: null)
        updateDelay: 300,                // int; the delay (in ms) before updates are triggered (default: 300)
        updateStack: 20                  // int; if the update delay cannot be reached, how many updates before force flush update trigger (default: 20)
    },

    _create: function() {
        if (this.element[0].nodeName.toLowerCase() !== 'textarea') {
            throw "Synthed must be initialized with a textarea";
        }

        this.options.parser = this.options.parser || '';
        this.options.updateElement = typeof this.options.updateElement === 'string'
            ? $(this.options.updateElement)
            : this.options.updateElement && this.options.updateElement.length
              ? this.options.updateElement
              : null;

        this._originalSetup = {
            width: this.element.width(),
            height: this.element.height(),
            fontFamily: this.element.css('font-family')
        };


        this.element.addClass(WIDGET_CSS_CLASS);

        this._applyBindings();
        this._refresh();
    },

    _applyBindings: function(unbind) {
        if (unbind) {
            this.element.unbind(WIDGET_EVENT_NAMESPACE)
        }
        this.element.bind(WIDGET_EVENT_BINDINGS, AsyncCall(this._triggerUpdate, this, this.options.updateDelay, this.options.updateStack));
    },

    _refresh: function() {
        this.element
            .width(this.options.width || this._originalSetup.width)
            .height(this.options.height || this._originalSetup.height)
            .css('font-family', this.options.fontFamily)
        ;

        this.element.trigger('change');
    },

    _triggerUpdate: function() {
        var evt = $.Event(WIDGET_EVENT_BEFORE_PARSE);
        this.element.trigger(evt);

        if (evt.isDefaultPrevented())
            return;

        var text = $.uix.synthed.Parsers[this.options.parser](this.element.val());

        evt = $.extend($.Event(WIDGET_EVENT_AFTER_PARSE), { parsedText: text });
        this.element.trigger(evt);

        if (evt.isDefaultPrevented())
            return;

        if (this.options.updateElement && this.options.updateElement.length)
            this.options.updateElement.html(evt.parsedText);
    },

    _setOption: function(key, value) {
        if (key === 'updateDelay' || key === 'updateStack') {
            this._applyBindings(true);
        }
        this._superApply( arguments );
    },

    // _setOptions is called with a hash of all options that are changing
    // always refresh when changing options
    _setOptions: function() {
        // _super and _superApply handle keeping the right this-context
        this._superApply( arguments );
        this._refresh();
    },

    insert: function(text, select) {
        text = text || '';
        var sel = getInputSelection(this.element[0]);
        var val = this.element.val();

        if ((sel.start == sel.end) && (text.length == 0)) return;  // nothing to do!

        this.element.val( val.slice(0, sel.start) + text + val.slice(sel.end, val.length) );

        if (!select)
            sel.end = (sel.start += text.length);
        else
            sel.end = sel.start + text.length;

        setInputSelection(this.element[0], sel.start, sel.end);

        this.element.trigger('change');
    },

    destroy: function() {
        this._super();

        this.element
            .removeClass(WIDGET_CSS_CLASS)
            .css('font-family', null)
            .unbind(WIDGET_EVENT_NAMESPACE)
            .width(this._originalSetup.width).height(this._originalSetup.height);
    }
});


/**
 * Class that will handle delayed function calls
 * @param fn     the funciton to call
 * @param ctx    the context to use as 'this' inside the function
 * @param delay  delay in millis
 * @param stack  how many calls before we force calling the function
 */
var AsyncCall = function(fn, ctx, delay, stack) {
    var timer = null;
    var counter = 0;

    ctx   = ctx || window;
    delay = delay || 0;
    stack = stack || 999999;

    return function() {
        counter++;

        // prevent calling the delayed function multiple times
        if (timer) clearTimeout(timer);

        if (counter >= stack) {
            counter = 0;
            fn.apply(ctx, arguments);
        } else {
            var args = arguments;

            timer = setTimeout(function() {
                counter = 0;
                timer = null;
                fn.apply(ctx, args);
            }, delay);
        }
    };
};


function getInputSelection(el) {
    var start = 0, end = 0, normalizedValue, range,
        textInputRange, len, endRange;

    if (typeof el.selectionStart == "number" && typeof el.selectionEnd == "number") {
        start = el.selectionStart;
        end = el.selectionEnd;
    } else {
        range = document.selection.createRange();

        if (range && range.parentElement() == el) {
            len = el.value.length;
            normalizedValue = el.value.replace(/\r\n/g, "\n");

            // Create a working TextRange that lives only in the input
            textInputRange = el.createTextRange();
            textInputRange.moveToBookmark(range.getBookmark());

            // Check if the start and end of the selection are at the very end
            // of the input, since moveStart/moveEnd doesn't return what we want
            // in those cases
            endRange = el.createTextRange();
            endRange.collapse(false);

            if (textInputRange.compareEndPoints("StartToEnd", endRange) > -1) {
                start = end = len;
            } else {
                start = -textInputRange.moveStart("character", -len);
                start += normalizedValue.slice(0, start).split("\n").length - 1;

                if (textInputRange.compareEndPoints("EndToEnd", endRange) > -1) {
                    end = len;
                } else {
                    end = -textInputRange.moveEnd("character", -len);
                    end += normalizedValue.slice(0, end).split("\n").length - 1;
                }
            }
        }
    }

    return {
        start: start,
        end: end
    };
}

function offsetToRangeCharacterMove(el, offset) {
    return offset - (el.value.slice(0, offset).split("\r\n").length - 1);
}

function setInputSelection(el, startOffset, endOffset) {
    if (endOffset === undefined || endOffset === null) endOffset = startOffset;

    if (typeof el.selectionStart == "number" && typeof el.selectionEnd == "number") {
        el.selectionStart = startOffset;
        el.selectionEnd = endOffset;
    } else {
        var range = el.createTextRange();
        var startCharMove = offsetToRangeCharacterMove(el, startOffset);
        range.collapse(true);
        if (startOffset == endOffset) {
            range.move("character", startCharMove);
        } else {
            range.moveEnd("character", offsetToRangeCharacterMove(el, endOffset));
            range.moveStart("character", startCharMove);
        }
        range.select();
    }
};


$.uix.synthed.GlobalOptions = {
    paragraphStart: '<p>',
    paragraphEnd: '</p>'
};

$.uix.synthed.Parsers = $.extend($.uix.synthed.Parsers || {}, {
    '': function(text) { return text; },
    'pre': function(text) { return '<pre>' + text + '</pre>'; }        // just put this inside preformatted block
});

$.uix.synthed.Toolbars = $.extend($.uix.synthed.Toolbars || {}, {
    'default': [
        { 'button':'B', 'action': function(t) { return '*' + $.trim(t) + '*'; } },
        { 'button':'I', 'action': function(t) { return '_' + $.trim(t) + '_'; } },
        { 'button':'U', 'action': function(t) { return '+' + $.trim(t) + '+'; } }
    ]
});

})(jQuery);
