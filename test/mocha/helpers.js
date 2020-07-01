/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brHttpsAgent = require('bedrock-https-agent');
const {httpClient} = require('@digitalbazaar/http-client');

exports.createRsvp = async ({ttl = 300000, type = 'someType', url}) => {
  const payload = {ttl, type};
  const {agent} = brHttpsAgent;
  const {data} = await httpClient.post(url, {agent, json: payload});
  return data;
};
