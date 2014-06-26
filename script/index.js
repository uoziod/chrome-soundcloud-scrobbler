/***
 * Add necessary items to page
 */

scrobbler.renderTemplate(
	'wrapper',
	function (rendered) {
		$('BODY').prepend(rendered);
	}
);



/***
 * Tick (runs every 1 second)
 */

scrobbler.tick = function() {

	// Get playing state
	scrobbler.isPlaying = $('.playControls__playPauseSkip .playControl').hasClass('playing');

	if (scrobbler.isPlaying) {

		// Get basic track info
		var title = $('title').text(),
			parts = title.split(/ by /);
		scrobbler.track = parts.shift().trim();
		scrobbler.artist = parts.join(' by ').trim();

		// Is it playlist?
		if (scrobbler.artist.length === 0 && scrobbler.track.match(' in ')) {
			parts = scrobbler.track.split(/ in /);
			scrobbler.track = parts.shift().trim();
			scrobbler.artist = parts.join(' in ').trim();
		}

		// Have we minus or dash in track name? Seems like real artist is there!
		if (scrobbler.track.match(/\s-\s|\s—\s/)) {
			parts = scrobbler.track.split(/\s-\s|\s—\s/);
			scrobbler.artist = parts.shift().trim();
			scrobbler.track = parts.join(' — ').trim();
		}

		// Remove "Free Download" text from track name
		if (scrobbler.track.match(/(\(|\[)?(free download)(\)|\])?/i)) {
			scrobbler.track = scrobbler.track.replace(/(\(|\[)?(free download)(\)|\])?/i, '');
		}

		// Clean track info
		scrobbler.artist = scrobbler.artist.replace(/^[^\[a-z\d]*|[^a-z\d\)]*$/gi, '');
		scrobbler.track = scrobbler.track.replace(/^[^\[a-z\d]*|[^a-z\d\)]*$/gi, '');

		// Compare track info with previous tick to check is it was changed
		scrobbler.trackChanged = scrobbler.track !== scrobbler.prevTrack || scrobbler.artist !== scrobbler.prevArtist;

		if (scrobbler.trackChanged) {
			scrobbler.playingTime = 1;
		} else {
			scrobbler.playingTime++;
		}

		// And keep current track info to compare it in next tick
		scrobbler.prevTrack = scrobbler.track;
		scrobbler.prevArtist = scrobbler.artist;

	}

	// It seems user is logged in
	if (localStorage['scrobbler-name']) {

		if (scrobbler.isPlaying) {

			// DOM arrangements
			$('.scrobbler-artist').html(scrobbler.artist);
			$('.scrobbler-track').html(scrobbler.track);

			// Timeout bar animations
			var $timeoutBar = $('.scrobbler-timeout-bar'),
				percentage = scrobbler.playingTime / scrobbler.scrobbleTime;
			if (percentage < 1 && localStorage['scrobbler-state'] !== 'paused') {
				$timeoutBar.stop().fadeIn(500);
				$('.scrobbler-timeout-finished').stop().animate({width: $timeoutBar.width() * percentage}, 1000);
			} else {
				$timeoutBar.stop().fadeOut(500);
			}

			// Now is the time to submit track!
			if (scrobbler.playingTime === scrobbler.scrobbleTime && localStorage['scrobbler-state'] !== 'paused') {
				scrobbler.askLastFm(
					{
						method: 'track.scrobble',
						artist: scrobbler.artist,
						track: scrobbler.track,
						timestamp: parseInt(Date.now() / 1000),
						sk: localStorage['scrobbler-key']
					},
					function () {
						console.log('Chrome SoundCloud Scrobbler. ' + scrobbler.track + ' by ' + scrobbler.artist + ' was submitted to Last.fm for ' + localStorage['scrobbler-name'] + '.');
					}
				);
			}

		}

	}

};



/***
 * Bindings and Initialization
 */

$('BODY')
	.on('click', '.scrobbler-caller', function () {

		$('.scrobbler-caller').addClass('active');

		if (!localStorage['scrobbler-name']) {

			scrobbler.renderTemplate(
				'login',
				'.scrobbler-container'
			);

		} else {

			scrobbler.renderTemplate(
				'main',
				function (rendered) {
					$('.scrobbler-container').html(rendered);

					if (scrobbler.isPlaying) {
						$('.scrobbler-nothingPlaying').hide();
						$('.scrobbler-nowPlaying').show();

						var $scrobblerStatePause = $('.scrobbler-state-pause'),
							$scrobblerStateResume = $('.scrobbler-state-resume');

						if (localStorage['scrobbler-state'] !== 'paused') {
							$scrobblerStatePause.show();
							$scrobblerStateResume.hide();
						} else {
							$scrobblerStatePause.hide();
							$scrobblerStateResume.show();
						}
					} else {
						$('.scrobbler-nothingPlaying').show();
						$('.scrobbler-nowPlaying').hide();
					}
				},
				{
					"artist": scrobbler.artist,
					"track": scrobbler.track,
					"username": localStorage['scrobbler-name']
				});

		}

	})
	.on('click', '.scrobbler-login', function(e) {
		e.preventDefault();

		window.location.href = 'http://www.last.fm/api/auth/?api_key=' + scrobbler.key + '&cb=' + window.location.href;
	})
	.on('click', '.scrobbler-close', function(e) {
		e.preventDefault();

		$('.scrobbler-caller').removeClass('active');
		$('.scrobbler-container').html('');
	})
	.on('click', '.scrobbler-state-pause', function(e) {
		e.preventDefault();

		localStorage['scrobbler-state'] = 'paused';
		$('.scrobbler-state-pause').hide();
		$('.scrobbler-state-resume').show();
	})
	.on('click', '.scrobbler-state-resume', function(e) {
		e.preventDefault();

		scrobbler.playingTime = 1;

		localStorage.removeItem('scrobbler-state');
		$('.scrobbler-state-pause').show();
		$('.scrobbler-state-resume').hide();
	})
	.on('click', '.scrobbler-logout', function(e) {
		e.preventDefault();

		localStorage.removeItem('scrobbler-key');
		localStorage.removeItem('scrobbler-name');

		$('.scrobbler-container').html('');
		$('.scrobbler-timeout-bar').hide();
	});


$(window).ready(function() {

	// It seems user is back from Last.fm with confirmed API usage request.
	// Ok! Trying to get and store username and key for further requests
	if (scrobbler.getSearchParameters().token) {
		scrobbler.askLastFm(
			{
				method: 'auth.getSession',
				token: scrobbler.getSearchParameters().token
			},
			function (data) {

				// Yes! We have something to keep
				var $xml = $(data);
				localStorage['scrobbler-name'] = $xml.find('name').text();
				localStorage['scrobbler-key'] = $xml.find('key').text();

			}
		);
	}

	setInterval(scrobbler.tick, 1000);

});
