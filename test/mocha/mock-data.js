/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const mocks = {};
module.exports = mocks;

mocks.rsvpResponses = {
  alpha: {
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
  },
};
