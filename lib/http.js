/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import api from './api.js';
import bedrock from 'bedrock';
import {asyncHandler} from 'bedrock-express';
const {config, util: {delay}} = bedrock;

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
      const result = await api.handleResponse({rsvpId});
      res.json(result);
    }));

  app.get(
    routes.rsvp,
    asyncHandler(async (req, res) => {
      const {params: {rsvpId}} = req;

      await api.handleHostListener({rsvpId, domain: config.server.domain});

      // TODO: lookup rsvpId and listen for an event directed at that ID
      const event = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Invite',
        summary: 'ACME invites you to complete your checkout experience.',
        actor: {
          id: '<ideally a DID, but perhaps not present>',
          type: 'Organization',
          name: 'ACME, Inc.'
        },
        // FIXME: Discuss usage of 'object' here.
        object: {
          type: 'Event',
          name: 'Checkout at ACME',
          url: 'https://acme.example.com/checkout/32f326g364gf3'
        }
      };

      // mandatory headers and http status to keep connection open
      const headers = {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache'
      };
      res.writeHead(200, headers);

      // TODO: this listener can be used to detect connections that were
      // closed by the client prematurely, do we destroy the rsvpId and
      // start the entire interaction over or try to resume?
      req.on('close', () => {
        console.log(`RSVPID: ${rsvpId} Connection closed`);
      });

      // TODO: this may not be a thing
      // this introductory message tells the client to standby, allows a
      // UI to move from QRCode to a wait status
      // res.write(JSON.stringify({
      //   type: 'a',
      //   timestamp: (new Date).toISOString(),
      // }));

      // TODO:
      await delay(5000);

      // TODO: this payload will include information about the sender
      // that may come from some manifest file or elsewhere
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      res.end();
    }));
});
