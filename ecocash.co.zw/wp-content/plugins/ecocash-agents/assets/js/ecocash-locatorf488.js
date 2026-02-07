(function($) {
    'use strict';
    
    /**
     * EcoCash Agent Locator Class
     * Modern implementation with enhanced map markers and better UX
     */
    class EcocashLocator {
        constructor() {
            // Configuration
            this.config = {
                defaultCenter: [-19.015438, 29.154857], // Harare, Zimbabwe
                defaultZoom: 6,
                maxZoom: 18,
                searchDelay: 300,
                animationDuration: 300,
                zimbabweBounds: [
                    [-22.4, 25.2], // Southwest
                    [-15.6, 33.1]  // Northeast
                ]
            };
            
            // State management
            this.state = {
                map: null,
                markers: [],
                agents: [],
                filteredAgents: [],
                userLocation: null,
                userMarker: null,
                activeMarker: null,
                currentTransactionType: '0',
                isLoading: false,
                markersGroup: null
            };
            
            // Bind methods
            this.init = this.init.bind(this);
            this.loadAgents = this.loadAgents.bind(this);
            this.performSearch = this.performSearch.bind(this);
            this.findNearMe = this.findNearMe.bind(this);
            this.clearFilters = this.clearFilters.bind(this);
            this.applyFilters = this.applyFilters.bind(this);
            
            // Initialize when DOM is ready
            $(document).ready(this.init);
        }
        
        /**
         * Initialize the application
         */
        init() {
            try {
                this.initializeMap();
                this.bindEvents();
                this.loadInitialAgents();
                this.showMessage('Welcome! Loading EcoCash agents across Zimbabwe...', 'info');
            } catch (error) {
                console.error('Failed to initialize EcoCash Locator:', error);
                this.showMessage('Failed to initialize locator. Please refresh the page.', 'error');
            }
        }
        
        /**
         * Initialize the Leaflet map
         */
        initializeMap() {
            // Initialize map with Zimbabwe view
            this.state.map = L.map('zimbabwe-map', {
                center: this.config.defaultCenter,
                zoom: this.config.defaultZoom,
                maxZoom: this.config.maxZoom,
                zoomControl: true,
                attributionControl: true,
                preferCanvas: true // Better performance for many markers
            });
            
            // Add OpenStreetMap tiles with better styling
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | EcoCash Agent Locator',
                maxZoom: this.config.maxZoom,
                className: 'map-tiles'
            }).addTo(this.state.map);
            
            // Initialize markers group for better performance
            this.state.markersGroup = L.featureGroup().addTo(this.state.map);
            
            // Set max bounds to Zimbabwe (optional - allows some panning outside)
            this.state.map.setMaxBounds(this.config.zimbabweBounds);
            
            // Add map event listeners
            this.state.map.on('click', () => {
                this.clearActiveStates();
            });
            
            // Fit initial view to Zimbabwe
            this.state.map.fitBounds(this.config.zimbabweBounds, {
                padding: [20, 20]
            });
        }
        
        /**
         * Bind all event listeners
         */
        bindEvents() {
            // Search functionality
            $('#agent-search').on('input', this.debounce(this.performSearch, this.config.searchDelay));
            $('#agent-search').on('keypress', (e) => {
                if (e.which === 13) {
                    e.preventDefault();
                    this.performSearch();
                }
            });
            
            // Action buttons
            $('#near-me-btn').on('click', this.findNearMe);
            $('#clear-btn').on('click', this.clearFilters);
            
            // Filter change events
            $('#region-filter, #area-filter, #sort-filter').on('change', this.applyFilters);
            
            // Transaction type change
            $('#transaction-type').on('change', (e) => {
                this.state.currentTransactionType = e.target.value;
                this.loadAgents();
            });
            
            // Keyboard navigation
            $(document).on('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearActiveStates();
                }
            });
        }
        
        /**
         * Load initial agents for major cities
         */
        loadInitialAgents() {
            const majorCities = [
                { lat: -17.8292, lng: 31.0522, name: 'Harare' },
                { lat: -20.1594, lng: 28.5906, name: 'Bulawayo' },
                { lat: -18.9707, lng: 32.6593, name: 'Mutare' },
                { lat: -19.4500, lng: 29.8167, name: 'Gweru' },
                { lat: -20.9167, lng: 31.5833, name: 'Masvingo' },
                { lat: -17.3667, lng: 31.2167, name: 'Bindura' }
            ];
            
            // Load agents for each major city
            majorCities.forEach((city, index) => {
                setTimeout(() => {
                    this.loadAgents(city.lat, city.lng, index === 0);
                }, index * 700); // Stagger requests
            });
        }
        
        /**
         * Load agents from API
         */
        async loadAgents(lat = this.config.defaultCenter[0], lng = this.config.defaultCenter[1], showLoading = true) {
            
            if (this.state.isLoading) return;
            
            this.state.isLoading = true;
            if (showLoading) this.showLoading(true);
            
            try {
                const response = await $.ajax({
                    url: ecocash_ajax.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'get_ecocash_agents',
                        latitude: lat,
                        longitude: lng,
                        cashin: this.state.currentTransactionType,
                        nonce: ecocash_ajax.nonce
                    },
                    timeout: 30000
                });
                
                if (response.success && response.data && response.data.agents) {
                    this.processAgentsData(response.data.agents);
                } else {
                    throw new Error(response.data?.message || 'Invalid response from server');
                }
                
            } catch (error) {
                console.error('Failed to load agents:', error);
                
                let errorMessage = 'Failed to load agents. ';
                if (error.status === 0) {
                    errorMessage += 'Please check your internet connection.';
                } else if (error.status >= 500) {
                    errorMessage += 'Server error occurred.';
                } else {
                    errorMessage += error.responseJSON?.data?.message || 'Please try again later.';
                }
                
                this.showMessage(errorMessage, 'error');
            } finally {
                this.state.isLoading = false;
                if (showLoading) this.showLoading(false);
            }
        }
        
        /**
         * Process and merge agents data
         */
        processAgentsData(newAgents) {
            if (!Array.isArray(newAgents)) {
                console.warn('Invalid agents data received');
                return;
            }
            
            // Filter out duplicates and invalid entries
            const validNewAgents = newAgents.filter(agent => 
                agent && 
                agent.id && 
                agent.representative && 
                agent.latitude && 
                agent.longitude &&
                !this.state.agents.some(existingAgent => existingAgent.id === agent.id)
            );
            
            if (validNewAgents.length > 0) {
                this.state.agents = [...this.state.agents, ...validNewAgents];
                this.state.filteredAgents = [...this.state.agents];
                this.updateDisplay();
                this.populateFilters();
                
                if (this.state.agents.length === validNewAgents.length) {
                    // First load
                    this.showMessage(`Found ${this.state.agents.length} EcoCash agents`, 'success');
                }
            }
        }
        
        /**
         * Update the display with current filtered agents
         */
        updateDisplay() {
            this.renderAgentCards();
            this.renderMapMarkers();
            this.updateResultsCount();
        }
        
        /**
         * Render agent cards in the sidebar
         */
        renderAgentCards() {
            const $agentList = $('#agent-list');
            $agentList.empty();
            
            if (this.state.filteredAgents.length === 0) {
                const $noResults = $(`
                    <div class="no-results">
                        No agents found matching your criteria.
                        <br><small>Try adjusting your search or filters.</small>
                    </div>
                `);
                $agentList.append($noResults);
                return;
            }
            
            // Create and append agent cards
            this.state.filteredAgents.forEach((agent, index) => {
                const $card = this.createAgentCard(agent);
                
                // Add animation delay for staggered effect
                $card.css({
                    animationDelay: `${index * 50}ms`
                });
                
                $agentList.append($card);
            });
        }
        
        /**
         * Create an individual agent card
         */
        createAgentCard(agent) {
            const distance = agent.distance ? this.formatDistance(agent.distance) : '';
            const transactionType = this.state.currentTransactionType === '0' ? 'Cash In' : 'Cash Out';
            const typeClass = this.state.currentTransactionType === '0' ? 'cash-in' : 'cash-out';
            const initials = this.getInitials(agent.representative);
            
            const $card = $(`
                <div class="agent-card" data-agent-id="${agent.id}" tabindex="0" role="button" aria-label="View ${this.escapeHtml(agent.representative)} on map">
                    <div class="agent-header">
                        <div class="agent-icon" aria-hidden="true">${initials}</div>
                        <div class="agent-name">${this.escapeHtml(agent.representative)}</div>
                    </div>
                    <div class="agent-details">
                        <div class="agent-address">${this.escapeHtml(agent.address)}</div>
                        <div class="agent-meta">
                            ${distance ? `<span class="agent-distance">📍 ${distance}</span>` : ''}
                            <span class="agent-type ${typeClass}">${transactionType}</span>
                            ${agent.msisdn ? `<span class="agent-contact">📞 ${this.escapeHtml(agent.msisdn)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `);
            
            // Add click and keyboard event handlers
            $card.on('click keypress', (e) => {
                if (e.type === 'click' || (e.type === 'keypress' && e.which === 13)) {
                    this.focusOnAgent(agent);
                    this.setActiveCard($card);
                    
                    // Add click feedback
                    $card.addClass('clicked');
                    setTimeout(() => $card.removeClass('clicked'), 200);
                }
            });
            
            return $card;
        }
        
        /**
         * Get initials from representative name
         */
        getInitials(name) {
            if (!name) return '💰';
            const words = name.trim().split(' ');
            if (words.length === 1) {
                return words[0].substring(0, 2).toUpperCase();
            }
            return (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
        }
        
        /**
         * Set active card and clear others
         */
        setActiveCard($card) {
            $('.agent-card').removeClass('active');
            $card.addClass('active');
        }
        
        /**
         * Render markers on the map
         */
        renderMapMarkers() {
            // Clear existing markers
            this.state.markersGroup.clearLayers();
            this.state.markers = [];
            
            // Add markers for filtered agents
            this.state.filteredAgents.forEach(agent => {
                if (agent.latitude && agent.longitude) {
                    const marker = this.createMarker(agent);
                    this.state.markers.push(marker);
                    this.state.markersGroup.addLayer(marker);
                }
            });
            
            // Fit map to show all markers if we have any
            if (this.state.markers.length > 0 && this.state.markers.length < 100) {
                // Only auto-fit if reasonable number of markers
                this.state.map.fitBounds(this.state.markersGroup.getBounds().pad(0.1), {
                    maxZoom: 12
                });
            }
        }
        
        /**
         * Create a map marker for an agent
         */
        createMarker(agent) {
            const isActive = false;
            const marker = L.marker([agent.latitude, agent.longitude], {
                icon: this.createCustomIcon(isActive, agent),
                title: agent.representative,
                riseOnHover: true
            });
            
            // Create popup content
            const popupContent = this.createPopupContent(agent);
            marker.bindPopup(popupContent, {
                className: 'custom-popup',
                maxWidth: 320,
                closeButton: true,
                offset: [0, -10]
            });
            
            // Add click event
            marker.on('click', () => {
                this.focusOnAgent(agent);
                this.highlightMarker(marker);
            });
            
            // Store agent reference for easy access
            marker.agentData = agent;
            
            return marker;
        }
        
        /**
         * Create custom map icon
         */
        createCustomIcon(isActive = false, agent = null) {
            const size = isActive ? 36 : 30;
            const iconSize = isActive ? 20 : 16;
            const color = isActive ? '#28a745' : '#004b95';
            const shadow = isActive ? '0 6px 16px rgba(0,75,149,0.4)' : '0 3px 8px rgba(0,0,0,0.3)';
            const initials = agent ? this.getInitials(agent.representative) : '💰';
            
            return L.divIcon({
                className: `custom-marker ${isActive ? 'active' : ''}`,
                html: `
                    <div style="
                        background: linear-gradient(135deg, ${color}, ${color}dd);
                        color: white;
                        border-radius: 50%;
                        width: ${size}px;
                        height: ${size}px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: ${iconSize}px;
                        font-weight: 700;
                        border: 3px solid white;
                        box-shadow: ${shadow};
                        font-family: 'Poppins', sans-serif;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    ">${initials}</div>
                `,
                iconSize: [size, size],
                iconAnchor: [size/2, size/2],
                popupAnchor: [0, -size/2]
            });
        }
        
        /**
         * Create popup content for map marker
         */
        createPopupContent(agent) {
            const distance = agent.distance ? this.formatDistance(agent.distance) : '';
            const transactionType = this.state.currentTransactionType === '0' ? 'Cash In' : 'Cash Out';
            
            return `
                <div class="popup-content">
                    <div class="popup-header">${this.escapeHtml(agent.representative)}</div>
                    <div class="popup-address">${this.escapeHtml(agent.address)}</div>
                    ${agent.msisdn ? `<div class="popup-contact">📞 ${this.escapeHtml(agent.msisdn)}</div>` : ''}
                    ${distance ? `<div class="popup-distance">📍 ${distance} away</div>` : ''}
                    <div class="popup-type">${transactionType} Available</div>
                </div>
            `;
        }
        
        /**
         * Focus on a specific agent (map and card)
         */
        focusOnAgent(agent) {
            if (!agent.latitude || !agent.longitude) return;
            
            // Smooth animation to agent location
            this.state.map.flyTo([agent.latitude, agent.longitude], 15, {
                animate: true,
                duration: 1.2,
                easeLinearity: 0.25
            });
            
            // Find and highlight the corresponding card
            const $card = $(`.agent-card[data-agent-id="${agent.id}"]`);
            if ($card.length) {
                this.setActiveCard($card);
                
                // Scroll card into view
                const $container = $('.agent-cards');
                const cardTop = $card.position().top;
                const containerHeight = $container.height();
                
                if (cardTop < 0 || cardTop > containerHeight) {
                    $container.animate({
                        scrollTop: $container.scrollTop() + cardTop - containerHeight / 2
                    }, this.config.animationDuration);
                }
            }
        }
        
        /**
         * Highlight a specific marker
         */
        highlightMarker(marker) {
            // Reset previous active marker
            if (this.state.activeMarker && this.state.activeMarker !== marker) {
                this.state.activeMarker.setIcon(this.createCustomIcon(false, this.state.activeMarker.agentData));
            }
            
            // Highlight new marker
            marker.setIcon(this.createCustomIcon(true, marker.agentData));
            this.state.activeMarker = marker;
        }
        
        /**
         * Perform search based on search input
         */
        performSearch() {
            const searchTerm = $('#agent-search').val().toLowerCase().trim();
            
            if (!searchTerm) {
                this.state.filteredAgents = [...this.state.agents];
            } else {
                this.state.filteredAgents = this.state.agents.filter(agent => 
                    this.searchInAgent(agent, searchTerm)
                );
            }
            
            this.applyCurrentFilters();
            this.updateDisplay();
            
            // Announce results for screen readers
            const count = this.state.filteredAgents.length;
            this.announceToScreenReader(`Found ${count} agent${count !== 1 ? 's' : ''} matching "${searchTerm}"`);
        }
        
        /**
         * Search within agent data
         */
        searchInAgent(agent, searchTerm) {
            const searchFields = [
                agent.representative,
                agent.address,
                agent.city,
                agent.province,
                agent.msisdn
            ];
            
            return searchFields.some(field => 
                field && field.toLowerCase().includes(searchTerm)
            );
        }
        
        /**
         * Find agents near user's location
         */
        findNearMe() {
            if (!navigator.geolocation) {
                this.showMessage('Geolocation is not supported by your browser.', 'error');
                return;
            }
            
            const $button = $('#near-me-btn');
            $button.prop('disabled', true).html('🔄 Locating...');
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.state.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    // Load agents near user location
                    this.loadAgents(this.state.userLocation.lat, this.state.userLocation.lng);
                    
                    // Add user location marker
                    this.addUserLocationMarker();
                    
                    // Fly to user location
                    this.state.map.flyTo([this.state.userLocation.lat, this.state.userLocation.lng], 12, {
                        animate: true,
                        duration: 1.5
                    });
                    
                    this.showMessage('Location found! Showing nearby agents...', 'success');
                    $button.prop('disabled', false).html('📍 Near Me');
                },
                (error) => {
                    let errorMessage = 'Unable to get your location. ';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Please enable location permissions.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Location information unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Location request timed out.';
                            break;
                        default:
                            errorMessage += 'Please try again.';
                            break;
                    }
                    
                    this.showMessage(errorMessage, 'error');
                    $button.prop('disabled', false).html('📍 Near Me');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 300000
                }
            );
        }
        
        /**
         * Add user location marker to map
         */
        addUserLocationMarker() {
            if (!this.state.userLocation) return;
            
            // Remove existing user marker
            if (this.state.userMarker) {
                this.state.map.removeLayer(this.state.userMarker);
            }
            
            const userIcon = L.divIcon({
                className: 'user-location-marker',
                html: `
                    <div style="
                        background: linear-gradient(135deg, #28a745, #1e7e34);
                        color: white;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 4px solid white;
                        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
                        font-size: 12px;
                        font-weight: 700;
                        position: relative;
                    ">📍</div>
                    <div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        width: 40px;
                        height: 40px;
                        border: 2px solid #28a745;
                        border-radius: 50%;
                        transform: translate(-50%, -50%);
                        animation: pulse 2s infinite;
                        opacity: 0.6;
                    "></div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });
            
            this.state.userMarker = L.marker([this.state.userLocation.lat, this.state.userLocation.lng], {
                icon: userIcon,
                zIndexOffset: 1000
            }).addTo(this.state.map).bindPopup('Your Location');
            
            // Add pulse animation CSS if not exists
            if (!$('#pulse-animation').length) {
                $('head').append(`
                    <style id="pulse-animation">
                        @keyframes pulse {
                            0% { 
                                transform: translate(-50%, -50%) scale(1);
                                opacity: 0.6;
                            }
                            50% { 
                                transform: translate(-50%, -50%) scale(1.2);
                                opacity: 0.3;
                            }
                            100% { 
                                transform: translate(-50%, -50%) scale(1.4);
                                opacity: 0;
                            }
                        }
                    </style>
                `);
            }
        }
        
        /**
         * Clear all filters and reset state
         */
        clearFilters() {
            $('#agent-search').val('');
            $('#region-filter').val('');
            $('#area-filter').val('');
            $('#sort-filter').val('name');
            
            this.state.filteredAgents = [...this.state.agents];
            this.clearActiveStates();
            this.updateDisplay();
            
            // Reset map view to Zimbabwe
            this.state.map.fitBounds(this.config.zimbabweBounds, {
                padding: [20, 20]
            });
            
            this.showMessage('Filters cleared', 'info');
        }
        
        /**
         * Apply current filter selections
         */
        applyFilters() {
            this.applyCurrentFilters();
            this.updateDisplay();
        }
        
        /**
         * Apply filters without updating display (internal)
         */
        applyCurrentFilters() {
            const searchTerm = $('#agent-search').val().toLowerCase().trim();
            const selectedRegion = $('#region-filter').val();
            const selectedArea = $('#area-filter').val();
            const sortBy = $('#sort-filter').val();
            
            // Apply filters
            this.state.filteredAgents = this.state.agents.filter(agent => {
                const matchesSearch = !searchTerm || this.searchInAgent(agent, searchTerm);
                const matchesRegion = !selectedRegion || (agent.province === selectedRegion);
                const matchesArea = !selectedArea || (agent.city === selectedArea);
                
                return matchesSearch && matchesRegion && matchesArea;
            });
            
            // Apply sorting
            this.sortAgents(sortBy);
        }
        
        /**
         * Sort agents by specified criteria
         */
        sortAgents(sortBy) {
            switch (sortBy) {
                case 'distance':
                    this.state.filteredAgents.sort((a, b) => {
                        const distA = a.distance || 999999;
                        const distB = b.distance || 999999;
                        return distA - distB;
                    });
                    break;
                case 'name':
                default:
                    this.state.filteredAgents.sort((a, b) => 
                        a.representative.localeCompare(b.representative)
                    );
                    break;
            }
        }
        
        /**
         * Populate filter dropdowns with available options
         */
        populateFilters() {
            const regions = [...new Set(this.state.agents
                .map(agent => agent.province)
                .filter(Boolean)
            )].sort();
            
            const areas = [...new Set(this.state.agents
                .map(agent => agent.city)
                .filter(Boolean)
            )].sort();
            
            // Populate region filter
            const $regionFilter = $('#region-filter');
            $regionFilter.find('option:not(:first)').remove();
            regions.forEach(region => {
                $regionFilter.append(`<option value="${this.escapeHtml(region)}">${this.escapeHtml(region)}</option>`);
            });
            
            // Populate area filter
            const $areaFilter = $('#area-filter');
            $areaFilter.find('option:not(:first)').remove();
            areas.forEach(area => {
                $areaFilter.append(`<option value="${this.escapeHtml(area)}">${this.escapeHtml(area)}</option>`);
            });
        }
        
        /**
         * Update results count display
         */
        updateResultsCount() {
            const count = this.state.filteredAgents.length;
            const text = count === 1 ? '1 agent found' : `${count} agents found`;
            $('#results-count').text(text);
        }
        
        /**
         * Clear all active states
         */
        clearActiveStates() {
            $('.agent-card').removeClass('active');
            if (this.state.activeMarker) {
                this.state.activeMarker.setIcon(this.createCustomIcon(false, this.state.activeMarker.agentData));
                this.state.activeMarker = null;
            }
        }
        
        /**
         * Format distance for display
         */
        formatDistance(distance) {
            if (distance < 1000) {
                return `${Math.round(distance)}m`;
            } else {
                return `${(distance / 1000).toFixed(1)}km`;
            }
        }
        
        /**
         * Escape HTML to prevent XSS
         */
        escapeHtml(text) {
            if (typeof text !== 'string') return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        /**
         * Show loading state
         */
        showLoading(show) {
            const $loadingIndicator = $('#loading-indicator');
            
            if (show) {
                $loadingIndicator.fadeIn(300);
                $('body').addClass('loading');
            } else {
                $loadingIndicator.fadeOut(300);
                $('body').removeClass('loading');
            }
        }
        
        /**
         * Show message to user
         */
        showMessage(message, type = 'info', duration = 4000) {
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            
            const $message = $(`
                <div class="toast-message toast-${type}" role="alert" aria-live="polite">
                    <span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span>
                    <span class="toast-text">${this.escapeHtml(message)}</span>
                    <button class="toast-close" type="button" aria-label="Close message">&times;</button>
                </div>
            `);
            
            // Close button styles
            $message.find('.toast-close').css({
                background: 'none',
                border: 'none',
                color: 'inherit',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0',
                marginLeft: '12px',
                opacity: '0.8'
            });
            
            $('body').append($message);
            
            // Animate in
            requestAnimationFrame(() => {
                $message.css('transform', 'translateX(0)');
            });
            
            // Auto-remove after duration
            const removeMessage = () => {
                $message.css('transform', 'translateX(100%)');
                setTimeout(() => $message.remove(), 300);
            };
            
            // Close on click
            $message.on('click', '.toast-close', removeMessage);
            $message.on('click', (e) => {
                if (!$(e.target).hasClass('toast-close')) {
                    removeMessage();
                }
            });
            
            if (duration > 0) {
                setTimeout(removeMessage, duration);
            }
        }
        
        /**
         * Announce message to screen readers
         */
        announceToScreenReader(message) {
            const $announcement = $('<div class="sr-only" aria-live="polite" aria-atomic="true"></div>');
            $announcement.text(message);
            $('body').append($announcement);
            
            setTimeout(() => $announcement.remove(), 1000);
        }
        
        /**
         * Debounce function to limit API calls
         */
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        /**
         * Handle responsive behavior
         */
        handleResize() {
            if (this.state.map) {
                setTimeout(() => {
                    this.state.map.invalidateSize();
                }, 100);
            }
        }
    }
    
    // Initialize the locator when DOM is ready
    $(document).ready(() => {
        if ($('#ecocash-agent-locator').length) {
            window.ecocashLocator = new EcocashLocator();
            
            // Handle window resize
            $(window).on('resize', () => {
                clearTimeout(window.resizeTimeout);
                window.resizeTimeout = setTimeout(() => {
                    if (window.ecocashLocator && window.ecocashLocator.handleResize) {
                        window.ecocashLocator.handleResize();
                    }
                }, 250);
            });
        }
    });
    
})(jQuery);
