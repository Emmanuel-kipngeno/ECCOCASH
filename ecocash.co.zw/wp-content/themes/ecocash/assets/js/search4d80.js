jQuery( function( $ ) {

	var body = $( document.body ),
		caty = $( '.codevz-search-category' );

	// Header search custom category selection list.
	body.on( 'click', '.codevz-search-category > strong', function() {

		caty.find( '> div' ).slideToggle( 'fast' );

	}).on( 'click', '.codevz-search-category li', function() {

		var $this = $( this );

		$this.addClass( 'codevz-active' );
		caty.find( 'li' ).not( $this ).removeClass( 'codevz-active' );

		caty.find( '> div' ).slideUp( 'fast' );

		caty.find( '> strong span' ).html( $this.text() );

		caty.find( '> input' ).val( $this.attr( 'data-cat' ) ).trigger( 'change' );

	}).on( 'click', '.codevz-search-trending a', function() {

		$( '[name="s"]' ).val( $( this ).text() ).trigger( 'change' ).closest( 'form' ).submit();

	});

	// Header search forms.
	if ( $( '.outer_search' ).length ) {

		// non-required hidden fields for submit form.
		var hidden = $( '.outer_search input[type="hidden"]' ).not( 'input[name="post_type"],input[name="prcat"],input[name="lang"]' );

		// Add disabled attr to hidden inputs.
		hidden.attr( 'disabled', 'disabled' );

		// Input changes.
		var typingTimer; // Timer identifier
		var doneTypingInterval = 1000; // Time in ms to wait after last keystroke

		$( document ).on( 'keyup', '.cz_ajax_search [name="s"]', function( e, time ) {

		    var $this 	= $(this),
		        value   = $this.val(),
		        form    = $this.parent(),
		        results = form.next('.ajax_search_results'),
		        icon 	= $('button i', form),
		        org 	= 'fa ' + icon.data('xtra-icon'),
		        iLoader = 'fa fa-superpowers fa-pulse';

		    // Prevent duplicate requests for the same input
		    if (value === $this.data('codevz-prev-search')) {
		        return;
		    }

		    // Clear the previous timeout to debounce
		    clearTimeout(typingTimer);

		    // Start a new timeout
		    typingTimer = setTimeout(function() {

		        // Save the last searched value
		        $this.data('codevz-prev-search', value);

		        // Hide results if they are visible before sending new request
		        if (results.is(':visible')) {
		            results.stop(true, true).slideUp('fast');
		        }

		        // Check input length before sending request
		        if (value.length < 3) {
		            icon.removeClass(iLoader).addClass(org);
		            return;
		        } else {
		            icon.removeClass(org).addClass(iLoader);
		        }

		        // Temporary enable for AJAX
		        hidden.removeAttr('disabled');

		        // Send AJAX request
		        $.ajax({
		            type: "GET",
		            url: body.data('ajax') || ajaxurl,
		            dataType: 'html',
		            data: "action=codevz_ajax_search&" + form.serialize(),
		            success: function(data) {
		                results.html(data).stop(true, true).slideDown('fast'); // Prevent animation stacking
		                icon.removeClass(iLoader).addClass(org);
		                hidden.attr('disabled', 'disabled');
		            },
		            error: function(xhr, status, error) {
		                results.html('<b class="ajax_search_error">' + error + '</b>').stop(true, true).slideDown('fast');
		                icon.removeClass(iLoader).addClass(org);
		                hidden.attr('disabled', 'disabled');
		                console.log(xhr, status, error);
		            }
		        });

		    }, doneTypingInterval ); // Wait until user stops typing

		// Search icon
		}).on( 'click', '.search_with_icon', function( e ) {

			e.stopPropagation();

		}).on( 'click', '.search_with_icon [name="s"]', function() {

			if ( $( this ).val() ) {
				$( '.ajax_search_results' ).slideDown( 'fast' );
			}

		// Search dropdown.
		}).on( 'click', '.search_style_icon_dropdown .xtra-search-icon', function() {

			var x 		= $( this ),
				outer 	= x.parent().find('.outer_search'),
				row_h 	= x.closest('.row').height(),
				clr 	= x.closest('.clr');

			if ( outer.is( ':visible' ) ) {
				outer.fadeOut( 'fast' );
			} else {
				outer.fadeIn( 'fast' ).find('input').trigger( 'focus' );
			}

		// Auto x-position search in header.
		}).on( 'mouseenter', '.search_style_icon_dropdown', function() {

			var x 			= $( this ),
				iconX 		= x.find( '.xtra-search-icon' ),
				iconWidth 	= iconX.outerWidth(),
				dropdown  	= x.find( '.outer_search' );

			if ( ( $( window ).width() / 2 ) > ( x.offset().left + 100 ) ) {

				x.addClass( 'inview_right' );

				var iconMl = parseFloat( iconX.css( 'marginLeft' ) );

				if ( body.hasClass( 'rtl' ) ) {
					dropdown.css( 'left', ( ( iconWidth / 2 ) - 38 + iconMl ) );
				} else {
					dropdown.css( 'left', -( ( iconWidth / 2 ) - 36 + iconMl ) );
				}

			} else {

				dropdown.css( 'right', ( ( iconWidth / 2 ) - 36 + parseFloat( iconX.css( 'marginRight' ) ) ) );

			}

		// Search fullscreen.
		}).on( 'click', '.search_style_icon_full .xtra-search-icon', function( e ) {

			var x = $( this );

			x.parent().find( '.outer_search' ).fadeIn( 'fast' ).find( 'input' ).trigger( 'focus' );

			$( window ).on( 'resize.search', function() {

				var t = $( this ),
					w = t.width(),
					h = t.height(),
					s = t.find('.outer_search .search');

				s.css({
					'top': h / 4 - s.height() / 2,
					'left': w / 2 - s.width() / 2
				});

			});

			x.parent().find( '.xtra-close-icon' ).toggleClass( 'hide' ).off().on( 'click', function( e ) {
				$( this ).addClass( 'hide' ).parent().find('.outer_search').fadeOut( 'fast' );
			});

		}).on( 'click', function( e ) {

			if ( $( e.target ).closest( '.outer_search .search' ).length ) {
				return;
			}

			body.find( '.ajax_search_results' ).fadeOut( 'fast' );
			body.find( '.search_style_icon_dropdown, .search_style_icon_full' ).find( '.outer_search' ).fadeOut( 'fast' );
			body.find( '.search_style_icon_full .xtra-close-icon' ).addClass( 'hide' );

			caty.find( '> div' ).slideUp( 'fast' );

		});

	}

});