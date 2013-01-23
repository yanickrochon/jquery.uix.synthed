/*
 * jQuery UIx SynthEd
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
        toolbarElement: null,            // string, Element; the element that will be used to render the toolbar (default: null)
        toolbar: null,                   // string; the toolbar to use (see $.uix.synthed.Toolbars). Will create new element
                                         //         before textarea if toolbarElement is null and toolbar is not null. (default: null)
        updateElement: null,             // string, Element; the element to update after text parsed event (default: null)
        updateDelay: 300,                // int; the delay (in ms) before updates are triggered (default: 300)
        updateStack: 20                  // int; if the update delay cannot be reached, how many updates before force flush update trigger (default: 20)
    },

    _create: function() {
        if (this.element[0].nodeName.toLowerCase() !== 'textarea') {
            throw "SynthEd must be initialized with a textarea";
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

        if (this.options.toolbar != null)
            this._setupToolbar();

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

    _setupToolbar: function() {
        if (this.options.toolbar === null ||
            this.options.toolbar === undefined ||
            this.options.toolbar === false ||
            !$.uix.synthed.Toolbars[this.options.toolbar])
        {
            return;
        }

        if (typeof this.options.toolbarElement === 'string') {
            this._toolbarElement = $(this.options.toolbarElement);
        } else if (this.options.toolbarElement) {
            this._toolbarElement = this.options.toolbarElement;
        } else {
            this._toolbarElement = $('<div></div>').insertBefore(this.element);
        }
        this._toolbarElement.addClass('ui-widget-header uix-synthed-toolbar').width(this.element.width() - 8);

        var createButton = $.proxy(function(ctrl,container) {
            var control = $.uix.synthed.Controls[ctrl];
            var button;

            if (typeof control['widget'] === 'string') {
                button = $('<button></button>').button({'label':control['widget']});
            } else if (typeof control['widget'] === 'function') {
                button = control['widget']();
            } else if (control['widget']) {
                button = control['widget'];
            }

            button.attr('title', control['description']).click($.proxy(function(evt) {
                if (this.element.prop('disabled')) return;  // disable button action if textare is disabled

                var sel = getInputSelection(this.element.focus()[0]);
                var oldSel = { start: sel.start, end: sel.end };

                this.element.prop('disabled', true);
                var rejected = control['action'].call(this.element[0], sel, $.proxy(function(value) {
                    if (rejected) return;

                    this.element.prop('disabled', false);

                    if (value)
                        this.insert(value, sel.start - oldSel.start, sel.end - oldSel.start);   // insert with relative selection
                }, this));

                if (rejected)
                    this.element.prop('disabled', false);

            }, this)).appendTo(container);

        }, this);

        $.each($.uix.synthed.Toolbars[this.options.toolbar], $.proxy(function(i,ctrl) {
            var btnSet = ctrl.split(",");
            var container = $('<span></span>').appendTo(this._toolbarElement);
            $.each(btnSet, function(i,ctrl) {
                createButton($.trim(ctrl), container);
            });
            container.buttonset();
        }, this));
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
        } else if (key === 'toolbarElement' || key === 'toolbar') {
            if (this._toolbarElement) {
                this._toolbarElement.remove();
                this._toolbarElement = null;
            }
            this._setupToolbar();
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

    insert: function(text, selectStart, selectEnd) {
        text = text || '';

        var sel = getInputSelection(this.element.focus()[0]);
        if ((sel.start == sel.end) && (text.length == 0)) return;  // nothing to do!

        insertText(this.element[0], text, sel);

        if (selectEnd)
            sel.end = sel.start + selectEnd;

        if (selectStart)
            sel.start += selectStart;

        setInputSelection(this.element[0], sel.start, sel.end);

        this.element.trigger('change');
    },

    destroy: function() {
        this._super();

        if (this._toolbarElement) this._toolbarElement.remove();
        this._toolbarElement = null;

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

/**
 * Return an object { start, end } identifying the current textarea caret positions
 *
 * @param el DOMelement  MUST be a textarea element
 * @return object
 */
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

/**
 * Fix end of line selection by returning a correcting offset (used by setInputSelection)
 */
function offsetToRangeCharacterMove(el, offset) {
    return offset - (el.value.slice(0, offset).split("\r\n").length - 1);
}

/**
 * Set the selection range
 */
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

/**
 * Insert some text into the specified textarea element at the caret position.
 * The argument `sel` should be an object { start, end } of the position where
 * the text should be inserted as a fallback measure in the event that the browser
 * does not support a text insertion event (thus preserving the undo/redo stack).
 *
 * @param el DOMelement    should be a textarea element
 * @param text string      the text to insert
 * @param sel object       the position where the text should be inserted
 */
function insertText(el, text, sel) {
    if (document.createEvent) {
        var event = document.createEvent('TextEvent');

        event.initTextEvent('textInput', true, true, null, text);
        el.dispatchEvent(event); // fire the event on the the textarea
    } else if (document.execCommand) {
        el.focus();
        document.execCommand('insertText', false, text);
    } else {
        var val = el.value;
        el.value = val.slice(0, sel.start) + text + val.slice(sel.end, val.length);
    }
};


/**
 * Utility function for the markup built-in controls.
 * See $.uix.synthed.Controls for more information
 */
function wrapWords(el, sel, delimiter) {
    var value = delimiter + el.value.substring(sel.start, sel.end) + delimiter;
    var incStart = 1;
    var incEnd = 1;
    if (sel.start > 0 && /[^ \t]/.test(el.value.charAt(sel.start - 1))) {
        ++incStart; ++incEnd;
        value = " " + value;
    }
    if (sel.end < el.value.length && /[^ \t]/.test(el.value.charAt(sel.end))) {
        value += " ";
    }
    sel.start += incStart; sel.end += incEnd;
    return value;
};

/**
 * Table of built-in "parsers". When supplying the 'parser' widget
 * option, it's value should indicate one of the parsers declared here.
 * Included scripts may declare such parser as :
 *
 *    $.uix.synthed.Parsers['nameOfParser'] = function(text) { ... }
 *
 * where the function receives the entire textarea value to parse and
 * should return the parsed text (HTML) to update the preview element.
 */
$.uix.synthed.Parsers = $.extend($.uix.synthed.Parsers || {}, {
    '': function(text) { return text; },
    'pre': function(text) { return '<pre>' + text + '</pre>'; }        // just put this inside preformatted block
});

/**
 * Table of available toolbars. When supplying the 'toolbar' widget
 * option, it's value should indicate one of the toolbars delcared here.
 * Included scripts may declare such toolbar as :
 *
 *    $.uix.synthed.TOolbars['toolbarName'] = array of buttons
 *
 * For example : ['button1', 'button2'] will create a toolbar with two
 *               separate controls.
 *               ['button1,'button2', 'button3'] will create a toolbar
 *               with two controls in a set and a separate control
 *
 * All controls must exist!
 */
$.uix.synthed.Toolbars = $.extend($.uix.synthed.Toolbars || {}, {
    '': ['bold,italic,underline']
});

/**
 * Table of available controls. All controls in all toolbars should
 * be declared in this table. Each entry key is the toolbar control
 * name, and it's associated value is the control settings. Where :
 *
 *   'button'      {string | function | jQueryElement}
 *                 A string (label), a function that should return a jQuery
 *                 element, or a jQuery element itself that will be used to
 *                 create a button from. (less the string type, all returning
 *                 values should already have initialized a jQuery UI Button)
 *  'description'  {string}
 *                 Basically, the button title (will be applied to the button)
 *  'action'       {function}
 *                 An action function that should handle the text insertion. If
 *                 this function returns false, the action will be cancelled.
 *                 For convenience, the function is supplied with two arguments;
 *                 the selection object { start, end }, and a callback funciton
 *                 that should receive only one argument; the text to insert.
 *                 If the callback function is called with an empty argument
 *                 value, no text will be inserted. If the selection object is
 *                 modified at any moment, the changes will be reflected in the
 *                 textarea selection once the text is inserted.
 */
$.uix.synthed.Controls = $.extend($.uix.synthed.Controls || {}, {
    'bold': {
        'widget': '<strong>B</strong>',
        'description': 'Bold',
        'action': function(selection, fn) { fn(wrapWords(this, selection, "*")); }
    },
    'italic': {
        'widget': '<em>I</em>',
        'description': 'Italic',
        'action': function(selection, fn) { fn(wrapWords(this, selection, "_")); }
    },
    'underline': {
        'widget': '<span style="text-decoration:underline;">U</span>',
        'description': 'Underline',
        'action': function(selection, fn) { fn(wrapWords(this, selection, "+")); }
    }
});


})(jQuery);
