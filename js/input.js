(function($){

	var config = $.extend({
		getKey: function(file) {
			return file.name;
		}
	}, window.acfs3 || {});

	window.acfs3 = config;

	function updateTemplate($target, template, data) {
		return $target.html(template(data));
	}

	function updateField(key, value, postId) {
		jQuery.ajax({
			method: 'post',
			url: ajaxurl + '?action=acf-s3_update_field',
			data: {
				key: key,
				value: value,
				post_id: postId,
			},
		});
	}
	
	function initialize_field( $el ) {

		var $templateEl = $el.find('.acf-s3-files');
		var template = _.template($('#acf-s3-file-template').text());
		var files = window.ACF_S3_FILES;
		var postId = parseInt($templateEl.data('post-id'), 10);
		var fieldKey = $el.data('field_key');

		if ( !$.isArray(files) ) {
			files = [];
		}

		var render = updateTemplate.bind(null, $templateEl, template);

		render({files: files});

		var proxy = new S3Proxy(ajaxurl + '?action=acf-s3_content_action');
		var uploader = new S3FileUploader(proxy);

		proxy.listMultipartUploads().done(function(result) {

			if ( !result.Uploads ) {
				return;
			}

			result.Uploads.forEach(function(u) {
				proxy.abortMultipartUpload(u.Key, u.UploadId);
			});
		});

		function logFunc(arg) {
			console.log('Success - Key: ' + arg.Key + '; Part: ' + arg.PartNumber + '; ETag: ' + arg.ETag);
		}

		$el.on('change', 'input[type=file]', function(event) {
			var $this = $(event.target);
			var file = $this[0].files[0];

			files.push({
				name: config.getKey(file),
				uploaded: false,
				file: file
			});

			render({files: files});
		});

		$el.on('click', '.acf-s3-upload', function(event) {
			var $this = $(event.target);
			$this.html('Uploading...');
			$this.prop('disabled', true);
			var $file = $this.closest('.acf-s3-file');

			var id = $file.data('id');
			id = parseInt(id, 10);

			var item = files[id];
			var file = item.file;

			if ( file ) {
				var completedParts = 0;
				var totalParts = Math.ceil(file.size/uploader.partSize);
				var name = config.getKey(file);

				uploader.upload(name, file).then(function(res) {
					item.uploaded = true;
					render({files: files});

					updateField(fieldKey, _.pluck(files, 'name'), postId);
				}, null, function(progress) {
					completedParts++;

					$file.find('.progress').css({
						width: Math.round(100*completedParts/totalParts) + '%',
					});
				});
			}
		});

		$el.on('click', '.acf-s3-delete', function(event) {
			event.preventDefault(); // this is a link without target, so disable it

			if ( !confirm('Are you sure?') ) {
				return;
			}

			var $this = $(event.target);

			$this.html('Deleting...');
			$this.prop('disabled', true);

			var id = $this.closest('.acf-s3-file').data('id');
			id = parseInt(id, 10);

			var item = files[id];

			proxy.deleteObject(item.name).then(function(res) {
				files.splice(id, 1);
				render({files: files});

				updateField(fieldKey, _.pluck(files, 'name'), postId);
			});
		});

	}
	
	
	if( typeof acf.add_action !== 'undefined' ) {
	
		/*
		*  ready append (ACF5)
		*
		*  These are 2 events which are fired during the page load
		*  ready = on page load similar to $(document).ready()
		*  append = on new DOM elements appended via repeater field
		*
		*  @type	event
		*  @date	20/07/13
		*
		*  @param	$el (jQuery selection) the jQuery element which contains the ACF fields
		*  @return	n/a
		*/
		
		acf.add_action('ready append', function( $el ){
			
			// search $el for fields of type 'FIELD_NAME'
			acf.get_fields({ type : 's3_content'}, $el).each(function(){
				
				initialize_field( $(this) );
				
			});
			
		});
		
		
	} else {
		
		
		/*
		*  acf/setup_fields (ACF4)
		*
		*  This event is triggered when ACF adds any new elements to the DOM. 
		*
		*  @type	function
		*  @since	1.0.0
		*  @date	01/01/12
		*
		*  @param	event		e: an event object. This can be ignored
		*  @param	Element		postbox: An element which contains the new HTML
		*
		*  @return	n/a
		*/
		
		$(document).on('acf/setup_fields', function(e, postbox){
			
			$(postbox).find('.field[data-field_type="s3_content"]').each(function(){
				
				initialize_field( $(this) );
				
			});
		
		});
	
	
	}


})(jQuery);
