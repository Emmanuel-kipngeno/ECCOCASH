jQuery(document).ready(function($) {
    try {
        // Handle calculate button click
        $('#ecocash-calculate-btn').on('click', function(e) {
            e.preventDefault();
            
            // Clear previous errors and warnings
            clearValidationErrors();
            
            // Get input values
            const amount = $('#ecocash-amount').val().trim();
            const currency = $('#ecocash-currency').val();
            let transactionType = $('#ecocash-transaction-type').val();
            
            // Validate inputs
            let isValid = true;
            
            // Amount validation
            if (!amount) {
                showFieldError('ecocash-amount', 'Please enter an amount');
                isValid = false;
            } else if (isNaN(amount)) {
                showFieldError('ecocash-amount', 'Amount must be a number');
                isValid = false;
            } else if (parseFloat(amount) <= 0) {
                showFieldError('ecocash-amount', 'Amount must be greater than zero');
                isValid = false;
            }
            
            // Currency validation
            if (!currency) {
                showFieldError('ecocash-currency', 'Please select a currency');
                isValid = false;
            }
            
            // Transaction type validation
            if (!transactionType) {
                showFieldError('ecocash-transaction-type', 'Please select a transaction type');
                isValid = false;
            }
            
            // If basic validation failed, stop here
            if (!isValid) {
                return;
            }
            
            // Validate transaction limits (only if amount is valid)
            if (currency === 'USD' && parseFloat(amount) > 500) {
                showFieldError('ecocash-amount', 'USD transactions cannot exceed $500');
                $('#ecocash-amount').addClass('limit-exceeded');
                $('#ecocash-amount-warning').text('USD transactions cannot exceed $500').show();
                return;
            }

            if (currency === 'ZWG' && parseFloat(amount) > 8000) {
                showFieldError('ecocash-amount', 'ZWG transactions cannot exceed 8000');
                $('#ecocash-amount').addClass('limit-exceeded');
                $('#ecocash-amount-warning').text('ZWG transactions cannot exceed 8000').show();
                return;
            }

            // Convert transaction type to API format
            transactionType = convertTransactionType(transactionType);
            
            // Show loading state
            const resultsDiv = $('#ecocash-results-container');
            resultsDiv.html('<div class="ecocash-loading-spinner">Calculating tariff... <div class="ecocash-spinner"></div></div>').show();
            
            // Make AJAX request
            $.ajax({
                url: ecocash_ajax.ajax_url,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'ecocash_calculate',
                    nonce: ecocash_ajax.nonce,
                    amount: amount,
                    currency: currency,
                    transactionType: transactionType
                },
                success: function(response) {
                    console.log('Full API Response:', response);
                    
                    // Check for success first using our API response format
                    if (response.success === true) {
                        showSuccess(response, currency);
                    } else if (response.success === false) {
                        const errorMsg = response.responseMessage || 
                                       response.message || 
                                       'Failed to calculate tariff';
                        showError(errorMsg);
                    } else {
                        // Fallback to old logic for backward compatibility
                        const apiResponse = response.response || response;
                        
                        if (apiResponse.status === "200" || 
                            apiResponse.statusMessage === "SUCCEEDED" ||
                            apiResponse.responseCode === "00") {
                            showSuccess(apiResponse, currency);
                        } else {
                            const errorMsg = apiResponse.statusMessage || 
                                           response.responseMessage || 
                                           'Failed to calculate tariff';
                            showError(errorMsg);
                        }
                    }
                },
                error: function(xhr, status, error) {
                    let errorMessage = 'Connection error. Please try again later.';
                    
                    // Try to parse error response
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        if (errorResponse.message) {
                            errorMessage = errorResponse.message;
                        }
                    } catch (e) {
                        console.error('Error parsing error response:', e);
                    }
                    
                    showError(errorMessage);
                }
            });
        });

        // Handle clear/reset button click
        $(document).on('click', '#ecocash-clear-btn', function(e) {
            e.preventDefault();
            clearCalculator();
        });

        // Clear calculator function
        function clearCalculator() {
            // Clear all form fields
            $('#ecocash-amount').val('');
            $('#ecocash-currency').val('');
            $('#ecocash-transaction-type').val('');
            
            // Clear validation errors and warnings
            clearValidationErrors();
            
            // Hide results container with smooth animation
            const resultsDiv = $('#ecocash-results-container');
            if (resultsDiv.is(':visible')) {
                resultsDiv.fadeOut(300, function() {
                    $(this).html('').removeClass('show');
                });
            }
            
            // Remove any limit exceeded styling
            $('#ecocash-amount').removeClass('limit-exceeded');
            $('#ecocash-amount-warning').hide();
            
            // Remove any clear hints
            $('.ecocash-clear-hint').remove();
            
            // Focus back to amount field for better UX
            setTimeout(function() {
                $('#ecocash-amount').focus();
            }, 350);
            
            // Show a brief "cleared" message
            showClearMessage();
        }

        // Show brief clear confirmation
        function showClearMessage() {
            const clearMessage = $('<div class="ecocash-clear-message">✨ Calculator cleared - ready for new calculation</div>');
            
            // Add styles for the clear message
            clearMessage.css({
                'position': 'fixed',
                'top': '20px',
                'right': '20px',
                'background': 'linear-gradient(135deg, #10b981, #059669)',
                'color': 'white',
                'padding': '12px 20px',
                'border-radius': '10px',
                'font-weight': '600',
                'box-shadow': '0 4px 20px rgba(16, 185, 129, 0.3)',
                'z-index': '9999',
                'animation': 'slideInRight 0.3s ease-out',
                'font-size': '14px'
            });
            
            $('body').append(clearMessage);
            
            // Remove the message after 2 seconds
            setTimeout(function() {
                clearMessage.fadeOut(300, function() {
                    $(this).remove();
                });
            }, 2000);
        }

        // Clear validation errors function
        function clearValidationErrors() {
            $('.ecocash-form-group').removeClass('has-error');
            $('.ecocash-error-text').remove();
            $('#ecocash-amount-warning').hide();
            $('#ecocash-amount').removeClass('limit-exceeded');
        }

        // Function to show field-specific errors
        function showFieldError(fieldId, message) {
            const $field = $('#' + fieldId);
            $field.closest('.ecocash-form-group').addClass('has-error');
            
            // Add error message if not already present
            if (!$field.siblings('.ecocash-error-text').length) {
                $field.after(`<div class="ecocash-error-text">${message}</div>`);
            }
            
            // Scroll to the first error
            if ($('.has-error').length === 1) {
                $('html, body').animate({
                    scrollTop: $field.offset().top - 100
                }, 300);
            }
        }

        // Convert transaction type to API format
        function convertTransactionType(type) {
            const typeMap = {
                'sendmoney': 'SENDMONEY',
                'SENDMONEY': 'SENDMONEY',
            };
            return typeMap[type] || type.toUpperCase();
        }

        // Display success results with clear button
        function showSuccess(apiResponse, currency) {
            const resultsDiv = $('#ecocash-results-container');
            
            // Handle different response formats
            const amount = apiResponse.amount || $('#ecocash-amount').val();
            const serviceCharge = apiResponse.serviceCharge || '0.00';
            const taxAmount = apiResponse.taxAmount || '0.00';
            const totalTariff = apiResponse.totalTariff || '0.00';
            const totalAmount = apiResponse.totalAmount || 
                              (parseFloat(amount) + parseFloat(totalTariff)).toFixed(2);
            
            // Determine currency symbol
            const currencySymbol = currency === 'USD' ? '$' : '';
            
            resultsDiv.html(`
                <div class="ecocash-results-header">
                    <div class="ecocash-results-title">Your fee will be:</div>
                    <button id="ecocash-clear-btn" class="ecocash-clear-btn" title="Start a new calculation">
                        <span class="clear-icon">🔄</span>
                        <span class="clear-text">Calculate Again</span>
                    </button>
                </div>
                
                <div class="ecocash-results-content">
                    <div class="ecocash-fee-row">
                        <span class="ecocash-fee-label">Transaction Amount:</span>
                        <span class="ecocash-fee-value"><span class="ecocash-currency-symbol">${currencySymbol}</span>${parseFloat(amount).toFixed(2)} ${currency}</span>
                    </div>
                    
                    <div class="ecocash-fee-row">
                        <span class="ecocash-fee-label">Service Charge:</span>
                        <span class="ecocash-fee-value"><span class="ecocash-currency-symbol">${currencySymbol}</span>${parseFloat(serviceCharge).toFixed(2)} ${currency}</span>
                    </div>
                    
                    <div class="ecocash-fee-row">
                        <span class="ecocash-fee-label">Tax:</span>
                        <span class="ecocash-fee-value"><span class="ecocash-currency-symbol">${currencySymbol}</span>${parseFloat(taxAmount).toFixed(2)} ${currency}</span>
                    </div>
                    
                    <div class="ecocash-fee-row total">
                        <span class="ecocash-fee-label">Total Fee:</span>
                        <span class="ecocash-fee-value"><span class="ecocash-currency-symbol">${currencySymbol}</span>${parseFloat(totalTariff).toFixed(2)} ${currency}</span>
                    </div>
                    
                    <div class="ecocash-fee-row total">
                        <span class="ecocash-fee-label">Total to Pay:</span>
                        <span class="ecocash-fee-value"><span class="ecocash-currency-symbol">${currencySymbol}</span>${parseFloat(totalAmount).toFixed(2)} ${currency}</span>
                    </div>
                </div>
            `).addClass('show').show();
        }

        // Display error message with clear button
        function showError(message) {
            $('#ecocash-results-container').html(`
                <div class="ecocash-error-container">
                    <div class="ecocash-error-message">
                        <span class="ecocash-icon">❌</span>
                        <span class="error-text">${message}</span>
                    </div>
                    <div class="ecocash-error-actions">
                        <button id="ecocash-clear-btn" class="ecocash-clear-btn error-clear">
                            <span class="clear-icon">🔄</span>
                            <span class="clear-text">Try Again</span>
                        </button>
                    </div>
                </div>
            `).show();
        }

        // Real-time validation for amount limits
        $('#ecocash-amount, #ecocash-currency').on('input change', function() {
            const amount = parseFloat($('#ecocash-amount').val());
            const currency = $('#ecocash-currency').val();
            const warning = $('#ecocash-amount-warning');
            
            if (isNaN(amount)) {
                warning.hide();
                $('#ecocash-amount').removeClass('limit-exceeded');
                return;
            }
            
            if (currency === 'USD' && amount > 500) {
                $('#ecocash-amount').addClass('limit-exceeded');
                warning.text('USD transactions cannot exceed $500').show();
            } else if (currency === 'ZWG' && amount > 8000) {
                $('#ecocash-amount').addClass('limit-exceeded');
                warning.text('ZWG transactions cannot exceed 8000').show();
            } else {
                $('#ecocash-amount').removeClass('limit-exceeded');
                warning.hide();
            }
        });

        // Format amount input to 2 decimal places on blur
        $('#ecocash-amount').on('blur', function() {
            const amount = parseFloat($(this).val());
            if (!isNaN(amount) && amount > 0) {
                $(this).val(amount.toFixed(2));
            }
        });

        // Keyboard shortcut for clearing (Ctrl+R or Cmd+R)
        $(document).on('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'r' && $('#ecocash-results-container').is(':visible')) {
                e.preventDefault();
                clearCalculator();
            }
        });

        // Auto-clear results when user starts typing in amount field (optional)
        $('#ecocash-amount').on('input', function() {
            if ($('#ecocash-results-container').is(':visible') && $(this).val().length === 1) {
                // If user starts typing and results are visible, give option to clear
                const clearHint = $('.ecocash-clear-hint');
                if (clearHint.length === 0) {
                    $(this).after('<div class="ecocash-clear-hint">💡 <strong>Tip:</strong> Results from previous calculation are still shown. <a href="#" id="auto-clear-link">Click here to clear</a> or continue editing.</div>');
                }
            }
        });

        // Handle the auto-clear hint link
        $(document).on('click', '#auto-clear-link', function(e) {
            e.preventDefault();
            clearCalculator();
            $('.ecocash-clear-hint').remove();
        });

        // Clear hint when amount field is emptied
        $('#ecocash-amount').on('input', function() {
            if ($(this).val() === '') {
                $('.ecocash-clear-hint').remove();
            }
        });

        // Enhanced form validation on submit
        $('#ecocash-calculate-btn').on('click', function() {
            // Remove any existing clear hints when starting new calculation
            $('.ecocash-clear-hint').remove();
        });

        // Enter key support for quick calculations
        $('#ecocash-amount, #ecocash-currency, #ecocash-transaction-type').on('keypress', function(e) {
            if (e.which === 13) { // Enter key
                e.preventDefault();
                $('#ecocash-calculate-btn').click();
            }
        });

        // Auto-focus to next field when current field is completed
        $('#ecocash-amount').on('blur', function() {
            if ($(this).val() && !$('#ecocash-currency').val()) {
                $('#ecocash-currency').focus();
            }
        });

        $('#ecocash-currency').on('change', function() {
            if ($(this).val() && !$('#ecocash-transaction-type').val()) {
                $('#ecocash-transaction-type').focus();
            }
        });

        $('#ecocash-transaction-type').on('change', function() {
            if ($(this).val() && $('#ecocash-amount').val() && $('#ecocash-currency').val()) {
                // All fields filled, focus on calculate button
                $('#ecocash-calculate-btn').focus();
            }
        });

        // Prevent form submission on enter in the container
        $('.ecocash-calculator-container').on('submit', function(e) {
            e.preventDefault();
            $('#ecocash-calculate-btn').click();
        });

        // Initialize: focus on amount field when page loads
        setTimeout(function() {
            $('#ecocash-amount').focus();
        }, 500);

    } catch (error) {
        console.error('Calculator initialization error:', error);
        
        // Show user-friendly error message if initialization fails
        $('#ecocash-results-container').html(`
            <div class="ecocash-error-container">
                <div class="ecocash-error-message">
                    <span class="ecocash-icon">⚠️</span>
                    <span class="error-text">Calculator initialization failed. Please refresh the page and try again.</span>
                </div>
            </div>
        `).show();
    }
});