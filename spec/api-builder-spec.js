/*global describe, it, expect, jasmine, require, beforeEach */
var ApiBuilder = require('../src/api-builder'),
	Promise = require('bluebird');
describe('ApiBuilder', function () {
	'use strict';
	var underTest, requestHandler, lambdaContext, requestPromise, requestResolve, requestReject,
		postRequestHandler;
	beforeEach(function () {
		underTest = new ApiBuilder();
		requestHandler = jasmine.createSpy('handler');
		postRequestHandler = jasmine.createSpy('postHandler');
		lambdaContext = jasmine.createSpyObj('lambdaContext', ['done']);
		requestPromise = new Promise(function (resolve, reject) {
			requestResolve = resolve;
			requestReject = reject;
		});
	});
	describe('configuration', function () {
		it('can configure a single GET method', function () {
			underTest.get('/echo', requestHandler);
			expect(underTest.apiConfig()).toEqual({
				'echo': { methods: ['GET']}
			});
		});
		it('can configure a single route with multiple methods', function () {
			underTest.get('/echo', requestHandler);
			underTest.post('/echo', postRequestHandler);
			expect(underTest.apiConfig()).toEqual({
				'echo': { methods: ['GET', 'POST']}
			});
		});
		it('can override existing route', function () {
			underTest.get('/echo', requestHandler);
			underTest.get('/echo', postRequestHandler);
			expect(underTest.apiConfig()).toEqual({
				'echo': { methods: ['GET']}
			});
		});
	});
	describe('routing calls', function () {
		var apiRequest;
		beforeEach(function () {
			underTest.get('/echo', requestHandler);
			apiRequest = {
				context: {
					path: '/echo',
					method: 'GET'
				},
				queryString: {
					a: 'b'
				}
			};
		});
		it('complains about an unsuported route', function () {
			apiRequest.context.path = '/no';
			underTest.router(apiRequest, lambdaContext);
			expect(lambdaContext.done).toHaveBeenCalledWith(
				{type: 'InvalidRequest', message: 'no handler for /no:GET'});
		});
		it('can route calls to a single GET method', function (done) {
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(requestHandler).toHaveBeenCalledWith(apiRequest);
				expect(lambdaContext.done).toHaveBeenCalledWith(null, undefined);
			}).then(done, done.fail);
		});
		it('can route to multiple methods', function (done) {
			underTest.post('/echo', postRequestHandler);
			apiRequest.context.method = 'POST';
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(postRequestHandler).toHaveBeenCalledWith(apiRequest);
				expect(requestHandler).not.toHaveBeenCalled();
				expect(lambdaContext.done).toHaveBeenCalledWith(null, undefined);
			}).then(done, done.fail);
		});
		it('can route to multiple routes', function (done) {
			underTest.post('/echo2', postRequestHandler);
			apiRequest.context.path = '/echo2';
			apiRequest.context.method = 'POST';
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(postRequestHandler).toHaveBeenCalledWith(apiRequest);
				expect(requestHandler).not.toHaveBeenCalled();
				expect(lambdaContext.done).toHaveBeenCalledWith(null, undefined);
			}).then(done, done.fail);
		});
		it('can handle synchronous exceptions in the routed method', function (done) {
			requestHandler.and.throwError('Error');
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(jasmine.any(Error), undefined);
			}).then(done, done.fail);
		});
		it('can handle successful synchronous results from the request handler', function (done) {
			requestHandler.and.returnValue({hi: 'there'});
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {hi: 'there'});
			}).then(done, done.fail);
		});
		it('handles response promises without resolving', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext);
			Promise.resolve().then(function () {
				expect(lambdaContext.done).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('handles request promise rejecting', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith('Error', undefined);
			}).then(done, done.fail);
			requestReject('Error');
		});
		it('handles request promise resolving', function (done) {
			requestHandler.and.returnValue(requestPromise);
			underTest.router(apiRequest, lambdaContext).then(function () {
				expect(lambdaContext.done).toHaveBeenCalledWith(null, {hi: 'there'});
			}).then(done, done.fail);
			requestResolve({hi: 'there'});
		});
	});
});