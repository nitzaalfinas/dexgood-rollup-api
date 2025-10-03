import request from 'supertest';
import { app } from '../src/app';

describe('Health Endpoints', () => {
  describe('GET /health/live', () => {
    it('should return 200 for liveness check', async () => {
      const response = await request(app).get('/health/live');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        status: 'alive',
        timestamp: expect.any(String),
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get('/health/ready');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('redis');
      expect(response.body.checks).toHaveProperty('l1Rpc');
      expect(response.body.checks).toHaveProperty('l2Rpc');
    });
  });
});