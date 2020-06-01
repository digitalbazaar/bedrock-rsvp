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
      const result = await api.handleResponse({rsvpId});
      res.json(result);
    }));
});
