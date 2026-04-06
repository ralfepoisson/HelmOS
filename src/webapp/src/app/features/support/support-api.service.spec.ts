import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SupportApiService } from './support-api.service';

describe('SupportApiService', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__ = undefined;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    delete (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__;
  });

  it('loads the current support conversation for the browser session', async () => {
    const service = TestBed.inject(SupportApiService);
    const promise = service.getCurrentConversation('session-1');

    const request = httpTesting.expectOne('http://localhost:3000/api/support/conversations/current?sessionKey=session-1');
    expect(request.request.method).toBe('GET');
    request.flush(
      JSON.stringify({
        data: {
          conversation: {
            id: 'conv-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            status: 'OPEN',
            source: 'INLINE_HELP_WIDGET',
            lastRoute: '/idea-foundry',
            lastMessageAt: '2026-04-06T10:00:00.000Z',
            createdAt: '2026-04-06T09:55:00.000Z',
            updatedAt: '2026-04-06T10:00:00.000Z'
          },
          messages: [],
          tickets: []
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    const conversation = await promise;
    expect(conversation?.conversation.id).toBe('conv-1');
  });

  it('posts support messages through the authenticated API', async () => {
    const service = TestBed.inject(SupportApiService);
    const promise = service.sendMessage({
      sessionKey: 'session-1',
      messageText: 'Report a bug: blank screen',
      clientContext: { route: '/admin/support' }
    });

    const request = httpTesting.expectOne('http://localhost:3000/api/support/conversations/current/messages');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.messageText).toContain('Report a bug');
    request.flush(
      JSON.stringify({
        data: {
          conversation: {
            id: 'conv-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            status: 'OPEN',
            source: 'INLINE_HELP_WIDGET',
            lastRoute: '/admin/support',
            lastMessageAt: '2026-04-06T10:00:00.000Z',
            createdAt: '2026-04-06T09:55:00.000Z',
            updatedAt: '2026-04-06T10:00:00.000Z'
          },
          messages: [],
          ticket: {
            id: 'ticket-1',
            ticketKey: 'SUP-123',
            status: 'NEW',
            priority: 'MEDIUM',
            severity: 'MODERATE',
            category: 'BUG_REPORT',
            title: 'Blank screen',
            createdAt: '2026-04-06T10:00:00.000Z',
            updatedAt: '2026-04-06T10:00:00.000Z'
          },
          reply: {
            id: 'msg-2',
            messageIndex: 2,
            senderType: 'AGENT',
            senderUserId: null,
            messageText: 'I created ticket SUP-123.',
            messageFormat: 'MARKDOWN',
            status: 'SENT',
            detectedIntent: 'ticket_confirmation',
            metadata: null,
            createdAt: '2026-04-06T10:00:00.000Z'
          }
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    const response = await promise;
    expect(response.ticket?.ticketKey).toBe('SUP-123');
  });
});
