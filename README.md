jQuery SynthEd
==============
Version 0.1 (alpha)

Introduction
------------

Synthetic Editor (SynthEd) is a markup language editor using jQuery and jQuery UI themes ready. It is fully customizable and
can be used with just about *any* markup parser. It's smart update system automatically triggers the parsing event (that can
be stoped through `synthedbeforeparse` and `synthedparsed` jQuery events bound to the textarea) in a fully configurable way.

This widget is fully functional as it is, however more features are not implemented yet (ie. a configurable toolbar).

Requirements
------------

* jQuery 1.7.2+
* jQuery UI 1.8+

Usage
-----

    // transform the specified textarea into a textile markup editor (require ./parsers/textile.js)
    $('#textarea').synthed({ parser: 'textile' });

    // insert and select text (false to move caret to the end of inserted text)
    $('textarea').synthed('insert', '*Specify text*', true);

    // restore original element behaviour
    $('textarea').synthed('destroy');
