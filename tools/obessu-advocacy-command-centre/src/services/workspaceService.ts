import { getAccessToken } from './firebaseAuth';

/**
 * Encodes string to base64url for Gmail API RFC 2822
 */
function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
}

export interface GoogleTaskItem {
  id?: string;
  title: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
}

export const workspaceService = {
  /**
   * Google Calendar: Create an event
   */
  async createCalendarEvent(event: {
    title: string;
    description: string;
    location: string;
    date: string;
  }): Promise<{ id: string; htmlLink: string }> {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication required. Please sign in with Google.');

    const startDateTime = event.date.includes('T')
      ? event.date
      : `${event.date}T09:00:00Z`;
    const endDateTime = event.date.includes('T')
      ? new Date(new Date(event.date).getTime() + 2 * 3600000).toISOString()
      : `${event.date}T17:00:00Z`;

    const body = {
      summary: `[OBESSU Advocacy] ${event.title}`,
      description: event.description,
      location: event.location,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime }
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Failed to create Google Calendar event');
    }

    return await res.json();
  },

  /**
   * Google Calendar: List upcoming events
   */
  async listUpcomingEvents(maxResults = 10): Promise<GoogleCalendarEvent[]> {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication required');

    const now = new Date().toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        now
      )}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Failed to fetch calendar events');
    }

    const data = await res.json();
    return data.items || [];
  },

  /**
   * Google Calendar: Search events by query
   */
  async searchCalendarEvents(query: string, maxResults = 5): Promise<GoogleCalendarEvent[]> {
    const token = await getAccessToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(
          query
        )}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch {
      return [];
    }
  },

  /**
   * Gmail: Search messages by stakeholder query
   */
  async searchGmailMessages(query: string, maxResults = 5): Promise<Array<{
    id: string;
    threadId: string;
    snippet: string;
    subject: string;
    from: string;
    date: string;
  }>> {
    const token = await getAccessToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
          query
        )}&maxResults=${maxResults}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) return [];
      const data = await res.json();
      if (!data.messages || !Array.isArray(data.messages)) return [];

      const results = await Promise.all(
        data.messages.map(async (msgItem: { id: string; threadId: string }) => {
          try {
            const msgRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
            if (!msgRes.ok) return null;
            const msgData = await msgRes.json();
            const headers = msgData.payload?.headers || [];
            const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
            const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
            const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');

            return {
              id: msgData.id,
              threadId: msgData.threadId,
              snippet: msgData.snippet || '',
              subject: subjectHeader?.value || '(No Subject)',
              from: fromHeader?.value || 'Unknown Sender',
              date: dateHeader?.value || new Date().toISOString(),
            };
          } catch {
            return null;
          }
        })
      );

      return results.filter(Boolean) as any[];
    } catch {
      return [];
    }
  },

  async createTask(task: {
    title: string;
    notes?: string;
    due?: string;
  }): Promise<GoogleTaskItem> {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication required. Please sign in with Google.');

    // Get default task list
    const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!listsRes.ok) {
      throw new Error('Failed to retrieve Google Tasks list');
    }

    const listsData = await listsRes.json();
    const listId = listsData.items?.[0]?.id || '@default';

    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `[OBESSU] ${task.title}`,
        notes: task.notes || '',
        due: task.due ? (task.due.includes('T') ? task.due : `${task.due}T18:00:00Z`) : undefined
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Failed to create Google Task');
    }

    return await res.json();
  },

  /**
   * Google Docs & Drive: Create a rich Google Doc for policy briefing & open in new tab
   */
  async createGoogleDoc(title: string, content: string): Promise<{ documentId: string; documentUrl: string }> {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication required. Please sign in with Google.');

    // Step 1: Create empty document
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: `[OBESSU Briefing] ${title}` })
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Failed to create Google Doc');
    }

    const doc = await createRes.json();
    const documentId = doc.documentId;

    // Step 2: Insert text into the Google Doc
    const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `${content}\n\nGenerated by OBESSU Advocacy Command Centre • ${new Date().toLocaleDateString()}`
            }
          }
        ]
      })
    });

    if (!updateRes.ok) {
      console.warn('Doc created but batchUpdate failed to insert text');
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    return { documentId, documentUrl };
  },

  /**
   * Gmail: Send email or create draft
   */
  async sendEmail(to: string, subject: string, body: string): Promise<{ id: string }> {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication required. Please sign in with Google.');

    const emailContent = [
      `To: ${to}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      body,
      '',
      '---',
      'OBESSU Policy & Advocacy Team',
      'Organising Bureau of European School Student Unions',
      'Rue de la Sablonnière 20, 1000 Brussels, Belgium'
    ].join('\r\n');

    const raw = base64UrlEncode(emailContent);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Failed to send email via Gmail');
    }

    return await res.json();
  },

  /**
   * Gmail: Create draft message
   */
  async createDraft(to: string, subject: string, body: string): Promise<{ id: string }> {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication required. Please sign in with Google.');

    const emailContent = [
      `To: ${to}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      body
    ].join('\r\n');

    const raw = base64UrlEncode(emailContent);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: { raw } })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Failed to create Gmail draft');
    }

    return await res.json();
  },

  /**
   * Google Slides: Create a structured presentation template for OBESSU briefings
   */
  async createGoogleSlides(
    title: string,
    slides: Array<{
      title: string;
      subtitle?: string;
      bullets: string[];
      notes?: string;
    }>
  ): Promise<{ presentationId: string; presentationUrl: string }> {
    const token = await getAccessToken();
    if (!token) throw new Error('Authentication required. Please sign in with Google.');

    // Step 1: Create empty presentation
    const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: `[OBESSU Briefing Deck] ${title}` })
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Failed to create Google Slides presentation');
    }

    const presentation = await createRes.json();
    const presentationId = presentation.presentationId;

    // Step 2: Build batchUpdate requests to add slides
    try {
      const requests: any[] = [];

      slides.forEach((slide, index) => {
        const slideId = `slide_obessu_${index}_${Date.now()}`;
        const titleId = `title_${index}_${Date.now()}`;
        const bodyId = `body_${index}_${Date.now()}`;

        // Create slide
        requests.push({
          createSlide: {
            objectId: slideId,
            insertionIndex: index,
            slideLayoutReference: {
              predefinedLayout: index === 0 ? 'TITLE' : 'TITLE_AND_BODY'
            }
          }
        });
      });

      if (requests.length > 0) {
        await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requests })
        });
      }
    } catch (err) {
      console.warn('Created presentation but detailed slide batchUpdate was partial:', err);
    }

    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
    return { presentationId, presentationUrl };
  }
};
