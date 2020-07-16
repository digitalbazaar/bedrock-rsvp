/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brHttpsAgent = require('bedrock-https-agent');
const {httpClient} = require('@digitalbazaar/http-client');

exports.createRsvp = async ({type = 'someType', url}) => {
  const payload = {type};
  const {agent} = brHttpsAgent;
  const {data} = await httpClient.post(url, {agent, json: payload});
  return data;
};
