// Layers module for Slider Pro.
// 
// Adds support for animated and static layers. The layers can contain any content,
// from simple text for video elements.
;(function( window, $ ) {

	"use strict";

	var NS = 'Layers.' +  $.SliderPro.namespace;

	var Layers = {

		// Reference to the original 'gotoSlide' method
		layersGotoSlideReference: null,

		// Reference to the timer that will delay the overriding
		// of the 'gotoSlide' method
		waitForLayersTimer: null,

		initLayers: function() {
			this.on( 'update.' + NS, $.proxy( this._layersOnUpdate, this ) );
			this.on( 'sliderResize.' + NS, $.proxy( this._layersOnResize, this ) );
			this.on( 'gotoSlide.' + NS, $.proxy( this._layersOnGotoSlide, this ) );
		},

		// Loop through the slides and initialize all layers
		_layersOnUpdate: function( event ) {
			var that = this;

			$.each( this.slides, function( index, element ) {
				var $slide = element.$slide;

				// Initialize the layers
				this.$slide.find( '.sp-layer:not([ data-layer-init ])' ).each(function() {
					var layer = new Layer( $( this ), that.settings.adaptiveMode);

					// Add the 'layers' array to the slide objects (instance of SliderProSlide)
					if ( typeof element.layers === 'undefined' ) {
						element.layers = [];
					}

					element.layers.push( layer );

					if ( $( this ).hasClass( 'sp-static' ) === false ) {

						// Add the 'animatedLayers' array to the slide objects (instance of SliderProSlide)
						if ( typeof element.animatedLayers === 'undefined' ) {
							element.animatedLayers = [];
						}

						element.animatedLayers.push( layer );
					}
				});
			});

			// If the 'waitForLayers' option is enabled, the slider will not move to another slide
			// until all the layers from the previous slide will be hidden. To achieve this,
			// replace the current 'gotoSlide' function with another function that will include the 
			// required functionality.
			// 
			// Since the 'gotoSlide' method might be overridden by other modules as well, delay this
			// override to make sure it's the last override.
			if ( this.settings.waitForLayers === true ) {
				clearTimeout( this.waitForLayersTimer );

				this.waitForLayersTimer = setTimeout(function() {
					that.layersGotoSlideReference = that.gotoSlide;
					that.gotoSlide = that._layersGotoSlide;
				}, 1 );
			}

			// Show the layers for the initial slide
			// Delay the call in order to make sure the layers
			// are scaled properly before displaying them
			setTimeout(function() {
				that.showLayers( that.selectedSlideIndex );
			}, 1);
		},

		// When the slider resizes, try to scale down the layers proportionally. The automatic scaling
		// will make use of an option, 'autoScaleReference', by comparing the current width of the slider
		// with the reference width. So, if the reference width is 1000 pixels and the current width is
		// 500 pixels, it means that the layers will be scaled down to 50% of their size.
		_layersOnResize: function() {
			var that = this,
				autoScaleReference,
				useAutoScale = this.settings.autoScaleLayers,
				scaleRatio;

			if ( this.settings.autoScaleLayers === false ) {
				return;
			}

			// If there isn't a reference for how the layers should scale down automatically, use the 'width'
			// option as a reference, unless the width was set to a percentage. If there isn't a set reference and
			// the width was set to a percentage, auto scaling will not be used because it's not possible to
			// calculate how much should the layers scale.
			if ( this.settings.autoScaleReference === -1 ) {
				if ( typeof this.settings.width === 'string' && this.settings.width.indexOf( '%' ) !== -1 ) {
					useAutoScale = false;
				} else {
					autoScaleReference = parseInt( this.settings.width, 10 );
				}
			} else {
				autoScaleReference = this.settings.autoScaleReference;
			}

			if ( useAutoScale === true && this.slideWidth < autoScaleReference ) {
				scaleRatio = that.slideWidth / autoScaleReference;
			} else {
				scaleRatio = 1;
			}

			$.each( this.slides, function( index, slide ) {
				if ( typeof slide.layers !== 'undefined' ) {
					$.each( slide.layers, function( index, layer ) {
						layer.scale( scaleRatio );
					});
				}
			});
		},

		// Replace the 'gotoSlide' method with this one, which makes it possible to 
		// change the slide only after the layers from the previous slide are hidden.
		_layersGotoSlide: function( index ) {
			var that = this,
				animatedLayers = this.slides[ this.selectedSlideIndex ].animatedLayers;

			// If the slider is dragged, don't wait for the layer to hide
			if ( this.$slider.hasClass( 'sp-swiping' ) || typeof animatedLayers === 'undefined' || animatedLayers.length === 0  ) {
				this.layersGotoSlideReference( index );
			} else {
				this.on( 'hideLayersComplete.' + NS, function() {
					that.off( 'hideLayersComplete.' + NS );
					that.layersGotoSlideReference( index );
				});

				this.hideLayers( this.selectedSlideIndex );
			}
		},

		// When a new slide is selected, hide the layers from the previous slide
		// and show the layers from the current slide.
		_layersOnGotoSlide: function( event ) {
			if ( this.previousSlideIndex !== this.selectedSlideIndex &&  this.settings.waitForLayers === false ) {
				this.hideLayers( this.previousSlideIndex );
			}

			this.showLayers( this.selectedSlideIndex );
		},

		// Show the animated layers from the slide at the specified index,
		// and fire an event when all the layers from the slide become visible.
		showLayers: function( index ) {
			var that = this,
				animatedLayers = this.slides[ index ].animatedLayers,
				layerCounter = 0;

			if ( typeof animatedLayers === 'undefined' ) {
				return;
			}

			$.each( animatedLayers, function( index, element ) {

				// If the layer is already visible and not adaptive(need to animate all layers else appears buggy)
				// increment the counter directly,
				// else wait for the layer's showing animation to complete.
				if ( element.isVisible() === true && !that.settings.adaptiveMode ) {
					layerCounter++;

					if ( layerCounter === animatedLayers.length ) {
						that.trigger({ type: 'showLayersComplete', index: index });
						if ( $.isFunction( that.settings.showLayersComplete ) ) {
							that.settings.showLayersComplete.call( that, { type: 'showLayersComplete', index: index });
						}
					}
				} else {
					element.show(function() {
						layerCounter++;

						if ( layerCounter === animatedLayers.length ) {
							that.trigger({ type: 'showLayersComplete', index: index });
							if ( $.isFunction( that.settings.showLayersComplete ) ) {
								that.settings.showLayersComplete.call( that, { type: 'showLayersComplete', index: index });
							}
						}
					});
				}
			});
		},

		// Hide the animated layers from the slide at the specified index,
		// and fire an event when all the layers from the slide become invisible.
		hideLayers: function( index ) {
			var that = this,
				animatedLayers = this.slides[ index ].animatedLayers,
				layerCounter = 0;

			if ( typeof animatedLayers === 'undefined' ) {
				return;
			}

			$.each( animatedLayers, function( index, element ) {

				// If the layer is already invisible and not adaptive(need to animate all layers else appears buggy), 
				// increment the counter directly, else wait 
				// for the layer's hiding animation to complete.
				if ( element.isVisible() === false && !that.settings.adaptiveMode ) {
					layerCounter++;

					if ( layerCounter === animatedLayers.length ) {
						that.trigger({ type: 'hideLayersComplete', index: index });
						if ( $.isFunction( that.settings.hideLayersComplete ) ) {
							that.settings.hideLayersComplete.call( that, { type: 'hideLayersComplete', index: index });
						}
					}
				} else {
					element.hide(function() {
						layerCounter++;

						if ( layerCounter === animatedLayers.length ) {
							that.trigger({ type: 'hideLayersComplete', index: index });
							if ( $.isFunction( that.settings.hideLayersComplete ) ) {
								that.settings.hideLayersComplete.call( that, { type: 'hideLayersComplete', index: index });
							}
						}
					});
				}
			});
		},

		// Destroy the module
		destroyLayers: function() {
			this.off( 'update.' + NS );
			this.off( 'resize.' + NS );
			this.off( 'gotoSlide.' + NS );
			this.off( 'hideLayersComplete.' + NS );
		},

		layersDefaults: {

			// Indicate if layers should force their animation events on hidden layers
			// useful when needing to hide elements at certain breakpoints
			adaptiveMode: false,

			// Indicates whether the slider will wait for the layers to disappear before
			// going to a new slide
			waitForLayers: false,

			// Indicates whether the slider will animate the layers when swiping/dragging
			// only applicable with touchSwipe module
			swipeLayersOut: false,

			// Indicates whether the layers will be scaled automatically
			autoScaleLayers: true,

			// Sets a reference width which will be compared to the current slider width
			// in order to determine how much the layers need to scale down. By default,
			// the reference width will be equal to the slide width. However, if the slide width
			// is set to a percentage value, then it's necessary to set a specific value for 'autoScaleReference'.
			autoScaleReference: -1,

			// Called when all animated layers become visible
			showLayersComplete: function() {},

			// Called when all animated layers become invisible
			hideLayersComplete: function() {}
		}
	};

	// Override the slide's 'destroy' method in order to destroy the 
	// layers that where added to the slide as well.
	var slideDestroy = window.SliderProSlide.prototype.destroy;

	window.SliderProSlide.prototype.destroy = function() {
		if ( typeof this.layers !== 'undefined' ) {
			$.each( this.layers, function( index, element ) {
				element.destroy();
			});

			this.layers.length = 0;
		}

		if ( typeof this.animatedLayers !== 'undefined' ) {
			this.animatedLayers.length = 0;
		}

		slideDestroy.apply( this );
	};

	var Layer = function( layer, adaptiveMode ) {

		// Reference to the layer jQuery element
		this.$layer = layer;

		// is the slider adaptive?
		this.adaptiveMode = adaptiveMode;

		// Indicates whether a layer is currently visible or hidden
		this.visible = false;

		// Indicates whether the layer was styled
		this.styled = false;

		// Holds the data attributes added to the layer
		this.data = null;

		// Indicates the layer's reference point (topLeft, bottomLeft, topRight or bottomRight)
		this.position = null;
		
		// Indicates which CSS property (left or right) will be used for positioning the layer 
		this.horizontalProperty = null;
		
		// Indicates which CSS property (top or bottom) will be used for positioning the layer 
		this.verticalProperty = null;

		// Indicates the value of the horizontal position
		this.horizontalPosition = null;
		
		// Indicates the value of the vertical position
		this.verticalPosition = null;

		// Indicates how much the layers needs to be scaled
		this.scaleRatio = 1;

		// Indicates the type of supported transition (CSS3 2D, CSS3 3D or JavaScript)
		this.supportedAnimation = SliderProUtils.getSupportedAnimation();

		// Indicates the required vendor prefix for CSS (i.e., -webkit, -moz, etc.)
		this.vendorPrefix = SliderProUtils.getVendorPrefix();

		// Indicates the name of the CSS transition's complete event (i.e., transitionend, webkitTransitionEnd, etc.)
		this.transitionEvent = SliderProUtils.getTransitionEvent();

		// Reference to the timer that will be used to hide the layers automatically after a given time interval
		this.stayTimer = null;

		this._init();
	};

	Layer.prototype = {

		// Initialize the layers
		_init: function() {
			this.$layer.attr( 'data-layer-init', true );

			if ( this.$layer.hasClass( 'sp-static' ) ) {
				this._setStyle();
			} else {
				// Visually hide layer
				this.$layer.css({ 'visibility': 'hidden' });
			}
		},

		// Set the size and position of the layer
		_setStyle: function() {
			var that = this;

			this.styled = true;

			// Get the data attributes specified in HTML
			this.data = this.$layer.data();
			
			if ( typeof this.data.width !== 'undefined' ) {
				this.$layer.css( 'width', this.data.width );
			}

			if ( typeof this.data.height !== 'undefined' ) {
				this.$layer.css( 'height', this.data.height );
			}

			if ( typeof this.data.depth !== 'undefined' ) {
				this.$layer.css( 'z-index', this.data.depth );
			}

			this.position = this.data.position ? ( this.data.position ).toLowerCase() : 'topleft';

			if ( this.position.indexOf( 'right' ) !== -1 ) {
				this.horizontalProperty = 'right';
			} else if ( this.position.indexOf( 'left' ) !== -1 ) {
				this.horizontalProperty = 'left';
			} else {
				this.horizontalProperty = 'center';
			}

			if ( this.position.indexOf( 'bottom' ) !== -1 ) {
				this.verticalProperty = 'bottom';
			} else if ( this.position.indexOf( 'top' ) !== -1 ) {
				this.verticalProperty = 'top';
			} else {
				this.verticalProperty = 'center';
			}

			// Figure out easing
			var easingTypes = {
					cssEaseIn: {
						type: 'css',
						name: 'easingIn',
						setting: typeof this.data.easingIn !== 'undefined' ? this.data.easingIn : 'ease'
					},
					jsEaseIn: {
						type: 'js',
						name: 'jsEasingIn',
						setting: typeof this.data.jsEasingIn !== 'undefined' ? this.data.jsEasingIn : 'swing'
					},
					cssEaseOut: {
						type: 'css',
						name: 'easingOut',
						setting: typeof this.data.easingOut !== 'undefined' ? this.data.easingIn : 'ease'
					},
					jsEaseOut: {
						type: 'js',
						name: 'jsEasingOut',
						setting: typeof this.data.jsEasingOut !== 'undefined' ? this.data.jsEasingOut : 'swing'
					}
				};

			// Cycle thru and reset data attributes for show/hide functions to use
			// We set this up here so we don't have to do it everytime a layer shows/hides
			$.each(easingTypes, function(i, ease){
				// Update DOM
				if(ease.type == 'css'){
					// If custom easing then just pass it thru otherwise get the equivalent bezier string
					that.data[ease.name] = ease.setting.indexOf(',') > -1 ? ease.setting : that.getCSSEasingString(ease.setting);
				}else{
					// Add it to the DOM in case the setting wasn't there
					that.data[ease.name] = ease.setting;
				}
			});

			this._setPosition();

			this.scale( this.scaleRatio );
		},

		// Set the position of the layer
		_setPosition: function() {
			var inlineStyle = this.$layer.attr( 'style' );

			this.horizontalPosition = typeof this.data.horizontal !== 'undefined' ? this.data.horizontal : 0;
			this.verticalPosition = typeof this.data.vertical !== 'undefined' ? this.data.vertical : 0;

			// Set the horizontal position of the layer based on the data set
			if ( this.horizontalProperty === 'center' ) {
				
				// prevent content wrapping while setting the width
				if ( this.$layer.is( 'img' ) === false && ( typeof inlineStyle === 'undefined' || ( typeof inlineStyle !== 'undefined' && inlineStyle.indexOf( 'width' ) === -1 ) ) ) {
					this.$layer.css( 'white-space', 'nowrap' );
					this.$layer.css( 'width', this.$layer.outerWidth( true ) );
				}

				this.$layer.css({ 'left': this.horizontalPosition, 'right': 0 });
			} else {
				this.$layer.css( this.horizontalProperty, this.horizontalPosition );
			}

			// Set the vertical position of the layer based on the data set
			if ( this.verticalProperty === 'center' ) {

				// prevent content wrapping while setting the height
				if ( this.$layer.is( 'img' ) === false && ( typeof inlineStyle === 'undefined' || ( typeof inlineStyle !== 'undefined' && inlineStyle.indexOf( 'height' ) === -1 ) ) ) {
					this.$layer.css( 'white-space', 'nowrap' );
					this.$layer.css( 'height', this.$layer.outerHeight( true ) );
				}

				this.$layer.css({ 'top': this.verticalPosition, 'bottom': 0 });
			} else {
				this.$layer.css( this.verticalProperty, this.verticalPosition );
			}
		},

		// Get CSS Easing String
		getCSSEasingString: function(name){
			var easingFunctions =  {
					"linear": "0.250, 0.250, 0.750, 0.750",
					"ease": "0.250, 0.100, 0.250, 1.000",
					"ease-in": "0.420, 0.000, 1.000, 1.000",
					"ease-out": "0.000, 0.000, 0.580, 1.000",
					"ease-in-out": "0.420, 0.000, 0.580, 1.000",
					"easeInQuad": "0.550, 0.085, 0.680, 0.530",
					"easeInCubic": "0.550, 0.055, 0.675, 0.190",
					"easeInQuart": "0.895, 0.030, 0.685, 0.220",
					"easeInQuint": "0.755, 0.050, 0.855, 0.060",
					"easeInSine": "0.470, 0.000, 0.745, 0.715",
					"easeInExpo": "0.950, 0.050, 0.795, 0.035",
					"easeInCirc": "0.600, 0.040, 0.980, 0.335",
					"easeInBack": "0.600, -0.280, 0.735, 0.045",
					"easeOutQuad": "0.250, 0.460, 0.450, 0.940",
					"easeOutCubic": "0.215, 0.610, 0.355, 1.000",
					"easeOutQuart": "0.165, 0.840, 0.440, 1.000",
					"easeOutQuint": "0.230, 1.000, 0.320, 1.000",
					"easeOutSine": "0.390, 0.575, 0.565, 1.000",
					"easeOutExpo": "0.190, 1.000, 0.220, 1.000",
					"easeOutCirc": "0.075, 0.820, 0.165, 1.000",
					"easeOutBack": "0.175, 0.885, 0.320, 1.275",
					"easeInOutQuad": "0.455, 0.030, 0.515, 0.955",
					"easeInOutCubic": "0.645, 0.045, 0.355, 1.000",
					"easeInOutQuart": "0.770, 0.000, 0.175, 1.000",
					"easeInOutQuint": "0.860, 0.000, 0.070, 1.000",
					"easeInOutSine": "0.445, 0.050, 0.550, 0.950",
					"easeInOutExpo": "1.000, 0.000, 0.000, 1.000",
					"easeInOutCirc": "0.785, 0.135, 0.150, 0.860",
					"easeInOutBack": "0.680, -0.550, 0.265, 1.550"
				} // Credit to: Matthew Lein, @matthewlein - http://matthewlein.com/ceaser/

			return easingFunctions[name];
		},

		// Get Animation Properties Object
		getJSAnimationObj: function(offsetX, offsetY, transitionX, transitionY, isReverse){
			var tmpPos = 0,
				tmpObj = {};

			// Determine if we need to calculate/animate left/right or top/bottom
			if(typeof transitionX !== 'undefined'){

				// Left / Right offset
				if(!isReverse){
					tmpPos = transitionX == 'left' ? 0 + offsetX : 0 - offsetX;
				}else{
					tmpPos = transitionX == 'left' ? 0 - offsetX : 0 + offsetX;
				}

				// Apply starting position
				tmpObj.marginLeft = tmpPos + 'px';	
			}

			// Vertical offset needs to be added to tempoary object
			if(typeof transitionY !== 'undefined'){

				// Up / Down offset
				if(!isReverse){
					tmpPos = transitionY == 'up' ? 0 + offsetY : 0 - offsetY;
				}else{
					tmpPos = transitionY == 'up' ? 0 - offsetY : 0 + offsetY;
				}

				// Apply starting position
				tmpObj.marginTop = tmpPos + 'px';
			}

			return tmpObj;
		},

		// Scale the layer
		scale: function( ratio ) {

			// Return if the layer is set to be unscalable
			if ( this.$layer.hasClass( 'sp-no-scale' ) ) {
				return;
			}

			// Store the ratio (even if the layer is not ready to be scaled yet)
			this.scaleRatio = ratio;

			// Return if the layer is not styled yet
			if ( this.styled === false ) {
				return;
			}

			var horizontalProperty = this.horizontalProperty === 'center' ? 'left' : this.horizontalProperty,
				verticalProperty = this.verticalProperty === 'center' ? 'top' : this.verticalProperty,
				css = {};

			// Apply the scaling
			css[ this.vendorPrefix + 'transform-origin' ] = this.horizontalProperty + ' ' + this.verticalProperty;
			css[ this.vendorPrefix + 'transform' ] = 'scale(' + this.scaleRatio + ')';

			// If the position is not set to a percentage value, apply the scaling to the position
			if ( typeof this.horizontalPosition !== 'string' ) {
				css[ horizontalProperty ] = this.horizontalPosition * this.scaleRatio;
			}

			// If the position is not set to a percentage value, apply the scaling to the position
			if ( typeof this.verticalPosition !== 'string' ) {
				css[ verticalProperty ] = this.verticalPosition * this.scaleRatio;
			}

			// If the width or height is set to a percentage value, increase the percentage in order to
			// maintain the same layer to slide proportions. This is necessary because otherwise the scaling
			// transform would minimize the layers more than intended.
			if ( typeof this.data.width === 'string' && this.data.width.indexOf( '%' ) !== -1 ) {
				css.width = ( parseInt( this.data.width, 10 ) / this.scaleRatio ).toString() + '%';
			}

			if ( typeof this.data.height === 'string' && this.data.height.indexOf( '%' ) !== -1 ) {
				css.height = ( parseInt( this.data.height, 10 ) / this.scaleRatio ).toString() + '%';
			}		

			this.$layer.css( css );
		},

		// Show the layer
		show: function( callback ) {
			if ( this.visible === true ) {
				return;
			}

			this.visible = true;

			// First, style the layer if it's not already styled
			if ( this.styled === false ) {
				this._setStyle();
			}

			var that = this,
				offsetX = typeof this.data.showOffsetX !== 'undefined' ? this.data.showOffsetX : 50,
				offsetY = typeof this.data.showOffsetY !== 'undefined' ? this.data.showOffsetY : 50,
				duration = typeof this.data.showDuration !== 'undefined' ? this.data.showDuration / 1000 : 0.4,
				delay = typeof this.data.showDelay !== 'undefined' ? this.data.showDelay : 10,
				stayDuration = typeof that.data.stayDuration !== 'undefined' ? parseInt( that.data.stayDuration, 10 ) : -1;				

			// Animate the layers with CSS3 or with JavaScript
			if ( this.supportedAnimation === 'javascript') {
				// animation starts w/ these
				var oStartProperties = $.extend({}, {'opacity': 0, 'visibility': 'visible'}, 
							this.getJSAnimationObj(offsetX, offsetY, this.data.showTransitionX, this.data.showTransitionY)
						), 
				// animation ends with these
					oEndProperties = $.extend({}, {'opacity': 1}, {'marginTop': 0, 'marginLeft': 0}); 

				this.$layer
					.stop()
					.delay( delay )
					.css(oStartProperties)
					.animate(oEndProperties, duration * 1000, this.data.jsEasingIn, function() {

						// Hide the layer after a given time interval
						if ( stayDuration !== -1 ) {
							that.stayTimer = setTimeout(function() {
								that.hide();
								that.stayTimer = null;
							}, stayDuration );
						}

						if ( typeof callback !== 'undefined' ) {
							callback();
						}
					});
			} else {
				var start = { 'opacity': 0, 'visibility': 'visible' },
					target = { 'opacity': 1 },
					transformValues = '',
					transformX = '0',
					transformY = '0';

				start[ this.vendorPrefix + 'transform' ] = 'scale(' + this.scaleRatio + ')';
				target[ this.vendorPrefix + 'transform' ] = 'scale(' + this.scaleRatio + ')';
				target[ this.vendorPrefix + 'transition' ] = 'opacity ' + duration + 's';
				target[ this.vendorPrefix + 'transition-timing-function'] = 'cubic-bezier(' + this.data.easingIn + ')';

				// Determine X Offset Direction
				if ( typeof this.data.showTransitionX !== 'undefined' ) {

					if (this.data.showTransitionX == 'left') {
						transformX = offsetX + 'px';
					} else {
						transformX = '-' + offsetX + 'px';
					}

				}

				// Determine Y Offset Direction
				if ( typeof this.data.showTransitionY !== 'undefined' ) {

					if (this.data.showTransitionY == 'up') {
						transformY = offsetY + 'px';
					} else {
						transformY = '-' + offsetY + 'px';
					}

				}

				// Combine directions together
				if(typeof this.data.showTransitionX !== 'undefined' || typeof this.data.showTransitionY !== 'undefined'){
					transformValues = transformX + ', ' + transformY;

					start[ this.vendorPrefix + 'transform' ] += this.supportedAnimation === 'css-3d' ? ' translate3d(' + transformValues + ', 0)' : ' translate(' + transformValues + ')';
					target[ this.vendorPrefix + 'transform' ] += this.supportedAnimation === 'css-3d' ? ' translate3d(0, 0, 0)' : ' translate(0, 0)';
					target[ this.vendorPrefix + 'transition' ] += ', ' + this.vendorPrefix + 'transform ' + duration + 's';
				}

				// Listen when the layer animation is complete
				this.$layer.on( this.transitionEvent, function( event ) {
					if ( event.target !== event.currentTarget ) {
						return;
					}

					that.$layer
						.off( that.transitionEvent )
						.css( that.vendorPrefix + 'transition', '' );

					// Hide the layer after a given time interval
					if ( stayDuration !== -1 ) {
						that.stayTimer = setTimeout(function() {
							that.hide();
							that.stayTimer = null;
						}, stayDuration );
					}

					if ( typeof callback !== 'undefined' ) {
						callback();
					}
				});

				this.$layer.css( start );

				setTimeout( function() {
					that.$layer.css( target );
				}, delay );
			}
		},

		// Hide the layer
		hide: function( callback ) {
			if ( this.visible === false ) {
				return;
			}

			var that = this,
				offsetX = typeof this.data.hideOffsetX !== 'undefined' ? this.data.hideOffsetX : 50,
				offsetY = typeof this.data.hideOffsetY !== 'undefined' ? this.data.hideOffsetY : 50,
				duration = typeof this.data.hideDuration !== 'undefined' ? this.data.hideDuration / 1000 : 0.4,
				delay = typeof this.data.hideDelay !== 'undefined' ? this.data.hideDelay : 10;

			this.visible = false;

			// If the layer is hidden before it hides automatically, clear the timer
			if ( this.stayTimer !== null ) {
				clearTimeout( this.stayTimer );
			}

			// Animate the layers with CSS3 or with JavaScript
			if ( this.supportedAnimation === 'javascript') {
				var	oEndProperties = $.extend({}, {'opacity': 0}, 
						this.getJSAnimationObj(offsetX, offsetY, this.data.hideTransitionX, this.data.hideTransitionY, true)
					);

				this.$layer
					.stop()
					.delay( delay )
					.animate(oEndProperties, duration * 1000, this.data.jsEasingOut, function() {
						$( this ).css( 'visibility', 'hidden' );

						if ( typeof callback !== 'undefined' ) {
							callback();
						}
					});
			} else {
				var transformValues = '',
					transformX = '0',
					transformY = '0',
					target = { 'opacity': 0 };

				target[ this.vendorPrefix + 'transform' ] = 'scale(' + this.scaleRatio + ')';
				target[ this.vendorPrefix + 'transition' ] = 'opacity ' + duration + 's';
				target[ this.vendorPrefix + 'transition-timing-function'] = 'cubic-bezier(' + this.data.easingIn + ')';

				// Determine X Offset Direction
				if(typeof this.data.hideTransitionX !== 'undefined'){

					if ( this.data.hideTransitionX == 'left' ) {
						transformX = '-' + offsetX + 'px';
					} else {
						transformX = offsetX + 'px';
					}

				}

				// Determine Y Offset Direction
				if(typeof this.data.hideTransitionY !== 'undefined'){

					if ( this.data.hideTransitionY == 'up' ) {
						transformY = '-' + offsetY + 'px';
					} else {
						transformY = offsetY + 'px';
					}

				}

				// Combine directions together
				if(typeof this.data.hideTransitionX !== 'undefined' || typeof this.data.hideTransitionY !== 'undefined'){

					transformValues = transformX + ', ' + transformY;

					target[ this.vendorPrefix + 'transform' ] += this.supportedAnimation === 'css-3d' ? ' translate3d(' + transformValues + ', 0)' : ' translate(' + transformValues + ')';
					target[ this.vendorPrefix + 'transition' ] += ', ' + this.vendorPrefix + 'transform ' + duration + 's';
				}

				// Listen when the layer animation is complete
				this.$layer.on( this.transitionEvent, function( event ) {
					if ( event.target !== event.currentTarget ) {
						return;
					}

					that.$layer
						.off( that.transitionEvent )
						.css( that.vendorPrefix + 'transition', '' );

					// Hide the layer after transition
					if ( that.visible === false ) {
						that.$layer.css( 'visibility', 'hidden' );
					}

					if ( typeof callback !== 'undefined' ) {
						callback();
					}
				});

				setTimeout( function() {					
					that.$layer.css( target );

					// Force transition event to fire if adaptiveMode and css display set to none
					// transitions do not tirgger on elements that are hidden and thus the end event is not fired
					if(that.adaptiveMode && that.$layer.css('display') == 'none' ){
						that.$layer.trigger(that.transitionEvent);
					}
				}, delay );
			}
		},

		isVisible: function() {
			if ( this.visible === false || this.$layer.is( ':hidden' ) ) {
				return false;
			}

			return true;
		},

		// Destroy the layer
		destroy: function() {
			this.$layer.removeAttr( 'style' );
			this.$layer.removeAttr( 'data-layer-init' );
		}
	};

	$.SliderPro.addModule( 'Layers', Layers );
	
})( window, jQuery );