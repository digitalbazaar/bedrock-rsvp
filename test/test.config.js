/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const path = require('path');

config.mocha.tests.push(path.join(__dirname, 'mocha'));

// mongodb config
config.mongodb.name = 'bedrock_rsvp_test';
config.mongodb.host = 'localhost';
config.mongodb.port = 27017;
// drop all collections on initialization
config.mongodb.dropCollections = {};
config.mongodb.dropCollections.onInit = true;
config.mongodb.dropCollections.collections = [];

config['https-agent'].rejectUnauthorized = false;
