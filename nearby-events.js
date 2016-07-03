$(function(){
  function distance(dest_lat, dest_lon, source_lat, source_lon, unit = 'mi') {
    var rad_dest_lat = Math.PI * dest_lat/180,
        rad_source_lat = Math.PI * source_lat/180,
        rad_dest_lon = Math.PI * dest_lon/180,
        rad_source_lon = Math.PI * source_lon/180,
        theta = dest_lon - source_lon,
        rad_theta = Math.PI * theta/180,
        dist = Math.sin(rad_dest_lat) * Math.sin(rad_source_lat) + Math.cos(rad_dest_lat) * Math.cos(rad_source_lat) * Math.cos(rad_theta);

    dist = Math.acos(dist);
    dist = dist * 180/Math.PI;
    dist = dist * 60 * 1.1515;
    if (unit === 'km') {
      dist = dist * 1.609344;
    }
    return parseFloat(dist.toFixed(2));
  }

  window.MapManager = class MapManager {
    constructor(){
      this.retrieveEvents();
      this.retrievePosition();
    }

    retrieveEvents(){
      $.getJSON('https://www.eventbriteapi.com/v3/events/search/', {
        'organizer.id': 7968957941,
        'token': 'SLFEA7QIEFSH5M66OCHU',
        'expand': 'venue,ticket_classes'
      }).then((data) => {
        this.events = data.events;
        this.ajaxComplete = true;
        this.render();
      });
    }

    retrievePosition(){
      navigator.geolocation.getCurrentPosition((position) => {
        this.position = position.coords;
        this.geolocationComplete = true;
        this.render();
      }, () => {
        this.position = false;
        this.geolocationComplete = true;
        this.render();
      });
    }

    render(){
      if(!this.geolocationComplete || !this.ajaxComplete){ return; }

      if(this.position !== false){
        this.events.forEach((e) => {
          e.distance = distance(e.venue.latitude, e.venue.longitude, this.position.latitude, this.position.longitude);
        });
      }

      // render next event
      var $nextEvent = $('.next-event'),
          nextEvent = this.eventsByDate.slice(0, 1)[0];

      if(!nextEvent){ return; }

      $nextEvent.find('.map').css({overflow: 'hidden', 'padding-top': 1})
        .html(`<img style="width: 100%; height: 100%;" src="https://api.mapbox.com/styles/v1/mapbox/streets-v8/static/${nextEvent.venue.longitude},${nextEvent.venue.latitude},14.25,0,0/180x180?access_token=pk.eyJ1Ijoia2F5YWt5YWtyIiwiYSI6ImNpcTV3MXk2ZTAwNXdma202azZ1cXhzd2gifQ.UpygC2yC47mFaVClCz01rw">`);
      $nextEvent.find('.name').html(nextEvent.name.html);
      $nextEvent.find('.date').html(`${moment(nextEvent.start.local).format('lll')} - ${moment(nextEvent.end.local).format('lll')}`);
      let addr = nextEvent.venue.address;
      $nextEvent.find('.location').html([addr.address_1, addr.address_2, addr.city, addr.region, addr.postal_code].filter((a) => a).join(', '));
      $nextEvent.wrap(`<a href="${nextEvent.url}"></a>`);
      $nextEvent.css({transition: 'opacity 0.75s ease'});
      setTimeout(() => $nextEvent.css({opacity: 1}), 0);

      // render nearby events
      var $nearbyEvents = $('.near-event, .near-event-1, .near-event-2, .near-event-3, .near-event-4, .near-event-5, .near-event-6'),
          nearbyEvents = this.eventsByDistance;

      $nearbyEvents.each((i, evt) => {
        if(!nearbyEvents[i]){ return; }
        let $evt = $(evt),
            nearby = nearbyEvents[i];
        $evt.find('.map').css({overflow: 'hidden'})
          .html(`<img style="width: 100%; height: 100%;" src="https://api.mapbox.com/styles/v1/mapbox/streets-v8/static/${nearby.venue.longitude},${nearby.venue.latitude},14.25,0,0/180x180?access_token=pk.eyJ1Ijoia2F5YWt5YWtyIiwiYSI6ImNpcTV3MXk2ZTAwNXdma202azZ1cXhzd2gifQ.UpygC2yC47mFaVClCz01rw">`);
        $evt.find('.name').html(nearby.name.html);
        $evt.find('.date').html(`${moment(nearby.start.local).format('lll')} - ${moment(nearby.end.local).format('lll')}`);
        let addr = nearby.venue.address;
        $evt.find('.location').html([addr.address_1, addr.address_2, addr.city, addr.region, addr.postal_code].filter((a) => a).join(', '));
        $evt.wrap(`<a href="${nearby.url}"></a>`);
        $evt.css({transition: `opacity 0.75s ease ${0.1 * (i + 1)}s`});
      });
      setTimeout(() => $nearbyEvents.css({opacity: 1}), 0);

      if(/googlebot/i.test(navigator.userAgent)){
        this.renderSEOMarkup();
      }
    }

    renderSEOMarkup(){
        let seoData = this.events.map((e) => {
          return {
            "@context": "http://schema.org",
            "@type": "Event",
            name: e.name.text,
            startDate: e.start.utc,
            endDate: e.end.utc,
            url: e.url,
            description: e.description.text,
            image: e.logo.url,
            location: {
              "@type": 'Place',
              name: e.venue.name,
              address: [e.venue.address.address_1, e.venue.address.address_2, e.venue.address.city, e.venue.address.region, e.venue.address.postal_code].filter((a) => a).join(', ')
            },
            offers: e.ticket_classes.map((tc) => {
              return {
                url: tc.resource_uri,
                name: tc.name,
                category: 'Primary',
                price: tc.cost ? tc.cost.value/100 : 0,
                priceCurrency: tc.cost ? tc.cost.currency : 'USD',
                availability: tc.on_sale_status === 'AVAILABLE' ? 'InStock' : 'SoldOut',
                validThrough: tc.sales_end
              }
            }),
            performer: {
              name: 'Jacob Dale',
              sameAs: 'https://www.linkedin.com/in/jacobdale'
            }
          }
        })
        $('body').append(`<script type="application/ld+json">
          ${JSON.stringify(seoData)}
        </script>`)
    }

    get eventsByDate(){
      return this.events.sort(function(a, b){
        return a.start.utc === b.start.utc ? 0 : a.start.utc > b.start.utc ? 1 : -1;
      });
    }

    get eventsByDistance(){
      if(this.position === false){
        return this.eventsByDate.slice(1);
      }

      // sort events by distance
      return this.events.sort(function(a, b){
        return a.distance - b.distance;
      });
    }
  }

  new MapManager();
});
