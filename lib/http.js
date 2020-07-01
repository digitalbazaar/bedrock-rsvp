/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import api from './api.js';
import bedrock from 'bedrock';
import {asyncHandler} from 'bedrock-express';
const {config} = bedrock;

const routes = {
  rsvps: '/rsvps',
  rsvp: '/rsvps/:rsvpId',
};

bedrock.events.on('bedrock-express.configure.routes', app => {
  const {baseUri} = config.server;
  const baseRsvpUrl = `${baseUri}${routes.rsvps}`;

  app.post(
    routes.rsvps,
    // validate('bedrock-rsvp.foo'),
    asyncHandler(async (req, res) => {
      const result = await api.createRequest(req.body);
      const response = {
        created: result.meta.created,
        ttl: result.rsvp.ttl,
        url: `${baseRsvpUrl}/${result.rsvp.id}`,
      };
      res.json(response);
    }));

  app.post(
    routes.rsvp,
    // validate('bedrock-rsvp.foo'),
    asyncHandler(async (req, res) => {
      const {params: {rsvpId}} = req;
      const {rsvp} = await api.handleResponse({rsvpId});

      const {server: {domain, httpPort}} = config;
      if(rsvp.listenerHost === `${domain}:${httpPort}`) {
        // the listener is attached to this Bedrock worker, notify the listener
        await bedrock.events.emit(
          `bedrock-rsvp.rsvp-response-${rsvpId}`, req.body);
        res.json({success: true});
        return;
      }

      // TODO: proxy the request to another location/domain
    }));

  app.get(
    routes.rsvp,
    asyncHandler(async (req, res) => {
      const {params: {rsvpId}} = req;

      // mandatory headers and http status to keep connection open
      const headers = {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache'
      };

      // register the location/domain for this listener
      await api.registerResponseListener({
        rsvpId,
        listenerHost: `${config.server.domain}:${config.server.httpPort}`,
      });

      // initiate the EventSource event stream
      res.writeHead(200, headers);

      bedrock.events.on(`bedrock-rsvp.rsvp-response-${rsvpId}`, async event => {
        // construct an EventSource event
        const evenSourceEvent = `data: ${JSON.stringify(event)}\n\n`;
        res.write(evenSourceEvent);
        res.end();
      });

      // TODO: this listener can be used to detect connections that were
      // closed by the client prematurely, do we destroy the rsvpId and
      // start the entire interaction over or try to resume?
      req.on('close', () => {
        console.log(`RSVPID: ${rsvpId} Connection closed`);
      });
    }));
});
