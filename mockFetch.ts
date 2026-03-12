import { MOCK_USERS, MOCK_PROFILES, MOCK_POSTS, MOCK_DUELS, MOCK_CHATS, MOCK_MESSAGES } from './mockData';

const MOCK_NOTIFICATIONS: any[] = [];

const createFakeJWT = (payload: any) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `${header}.${body}.signature`;
};

const originalFetch = globalThis.fetch;

export const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  if (url.includes('supabase.co')) {
    console.log('[MOCK FETCH]', url, init?.method);

    // Mock Auth
    if (url.includes('/auth/v1/signup')) {
      const body = JSON.parse(init?.body as string || '{}');
      const newUser = {
        id: `user-${Date.now()}`,
        email: body.email,
        name: body.data?.name || 'Novo Usuário',
        user_type: body.data?.user_type || 'jogador',
        total_likes: 1000,
        avatar_url: null
      };
      MOCK_USERS.push(newUser);
      MOCK_PROFILES.push({
        id: newUser.id,
        user_id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        user_type: newUser.user_type as any,
        total_likes: newUser.total_likes,
        avatar_url: newUser.avatar_url,
        bio: 'Novo perfil',
        created_at: new Date().toISOString()
      } as any);
      
      return new Response(JSON.stringify({
        user: {
          id: newUser.id,
          email: newUser.email,
          app_metadata: { provider: 'email' },
          user_metadata: body.data,
          aud: 'authenticated',
          created_at: new Date().toISOString()
        },
        session: {
          access_token: createFakeJWT({ sub: newUser.id, email: newUser.email, role: 'authenticated' }),
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: `mock-refresh-${newUser.id}`,
          user: { id: newUser.id, email: newUser.email }
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/auth/v1/token?grant_type=password')) {
      const body = JSON.parse(init?.body as string || '{}');
      const user = MOCK_USERS.find(u => u.email === body.email);
      if (user) {
        const token = createFakeJWT({ sub: user.id, email: user.email, role: 'authenticated' });
        return new Response(JSON.stringify({
          access_token: token,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: `mock-refresh-${user.id}`,
          user: {
            id: user.id,
            email: user.email,
            app_metadata: { provider: 'email' },
            user_metadata: { name: user.name },
            aud: 'authenticated',
            created_at: new Date().toISOString()
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 400 });
    }

    if (url.includes('/auth/v1/logout')) {
      return new Response(null, { status: 204 });
    }

    if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
      const authHeader = (init?.headers as any)?.['Authorization'] || '';
      const token = authHeader.replace('Bearer ', '');
      let userId = MOCK_USERS[0].id;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch (e) {}
      const user = MOCK_USERS.find(u => u.id === userId) || MOCK_USERS[0];
      const newToken = createFakeJWT({ sub: user.id, email: user.email, role: 'authenticated' });
      return new Response(JSON.stringify({
        access_token: newToken,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `mock-refresh-${user.id}`,
        user: {
          id: user.id,
          email: user.email,
          app_metadata: { provider: 'email' },
          user_metadata: { name: user.name },
          aud: 'authenticated',
          created_at: new Date().toISOString()
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/auth/v1/user')) {
      const authHeader = (init?.headers as any)?.['Authorization'] || '';
      const token = authHeader.replace('Bearer ', '');
      let userId = MOCK_USERS[0].id;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
      } catch (e) {}
      
      const user = MOCK_USERS.find(u => u.id === userId) || MOCK_USERS[0];
      
      return new Response(JSON.stringify({
        id: user.id,
        email: user.email,
        app_metadata: { provider: 'email' },
        user_metadata: { name: user.name },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/storage/v1/object/')) {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      // Handle list
      if (url.includes('/storage/v1/object/list/')) {
        const bucket = pathParts[pathParts.length - 1];
        console.log(`[MOCK STORAGE] Listing bucket ${bucket}`);
        return new Response(JSON.stringify([
          { name: 'test-file.mp4', id: '1', updated_at: new Date().toISOString(), metadata: { size: 1024 } }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // /storage/v1/object/bucket/path... or /storage/v1/object/public/bucket/path...
      const isPublic = pathParts[4] === 'public';
      const bucket = isPublic ? pathParts[5] : pathParts[4];
      const filePath = isPublic ? pathParts.slice(6).join('/') : pathParts.slice(5).join('/');

      if (init?.method === 'POST') {
        console.log(`[MOCK STORAGE] Uploading to ${bucket}/${filePath}`);
        return new Response(JSON.stringify({ Key: `${bucket}/${filePath}`, path: filePath, fullPath: `${bucket}/${filePath}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (isPublic && (init?.method === 'GET' || !init?.method)) {
        return new Response(JSON.stringify({ publicUrl: `https://mock-supabase.co/storage/v1/object/public/${bucket}/${filePath}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Mock REST API and RPC
    if (url.includes('/rest/v1/rpc/has_role')) {
      const body = JSON.parse(init?.body as string || '{}');
      const isAdmin = body._user_id === MOCK_USERS[0].id;
      return new Response(JSON.stringify(isAdmin), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/rest/v1/rpc/send_mimo')) {
      const body = JSON.parse(init?.body as string || '{}');
      const target = MOCK_PROFILES.find(p => p.user_id === body.p_jogador_id);
      if (target?.user_type !== 'jogador') {
        return new Response(JSON.stringify({ error: 'Mimo só para jogadores!' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify('chat-1'), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/rest/v1/rpc/notify_all_game_state')) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const gameOn = body.p_game_on;
      if (gameOn) {
        MOCK_PROFILES.forEach(profile => {
          MOCK_NOTIFICATIONS.unshift({
            id: `notif-${Date.now()}-${profile.user_id}`,
            user_id: profile.user_id,
            tipo: 'game_start',
            mensagem: '🎮 O Jogo Começou! Participe agora!',
            lido: false,
            created_at: new Date().toISOString()
          });
        });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (url.includes('/rest/v1/')) {
      const urlObj = new URL(url);
      const table = urlObj.pathname.split('/').pop();
      
      if (init?.method === 'GET' || init?.method === 'HEAD' || !init?.method) {
        let data: any[] = [];
        if (table === 'profiles') data = MOCK_PROFILES;
        if (table === 'posts') data = MOCK_POSTS;
        if (table === 'duels') data = MOCK_DUELS;
        if (table === 'chats') data = MOCK_CHATS;
        if (table === 'chat_messages') data = MOCK_MESSAGES;
        if (table === 'game_state') {
          const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('gameActive') : null;
          const gameOn = stored !== null ? JSON.parse(stored) : true;
          data = [{ id: 1, game_on: gameOn, updated_at: new Date().toISOString() }];
        }
        if (table === 'home_config') data = [{ id: 1, prize_value: 'R$50.000', prize_enabled: true, promo_text: 'Promoção', promo_text_2: 'Participe' }];
        if (table === 'sos_requests') data = [];
        if (table === 'compras_pix') data = [];
        if (table === 'blacklist_palavras') data = [];
        if (table === 'premios') data = [];
        if (table === 'doacoes_premios') data = [];
        if (table === 'temas') data = [];
        if (table === 'desafios') data = [];
        if (table === 'assets_marketing') data = [];
        if (table === 'follows') data = [];
        if (table === 'comments') data = [];
        if (table === 'comment_reactions') data = [];
        if (table === 'notifications') data = MOCK_NOTIFICATIONS;
        if (table === 'referrals') data = [];
        if (table === 'remixes') data = [];
        if (table === 'post_images') data = [];
        if (table === 'duel_votes') data = [];
        if (table === 'daily_reports') data = [];
        if (table === 'post_interactions') data = [];
        
        // Handle eq= filter
        for (const [key, value] of urlObj.searchParams.entries()) {
          if (key.startsWith('select')) continue;
          if (key === 'order') {
            const parts = value.split('.');
            const col = parts[0];
            const dir = parts[1] || 'asc';
            data = [...data].sort((a, b) => {
              if (a[col] < b[col]) return dir === 'desc' ? 1 : -1;
              if (a[col] > b[col]) return dir === 'desc' ? -1 : 1;
              return 0;
            });
            continue;
          }
          if (key === 'limit') continue; // Handled below
          if (key === 'or') {
            const conditions = value.replace(/^\((.*)\)$/, '$1').split(',');
            data = data.filter(item => {
              return conditions.some(cond => {
                const parts = cond.split('.');
                const col = parts[0];
                const op = parts[1];
                const val = parts.slice(2).join('.');
                if (op === 'eq') return String(item[col]) === String(val);
                return false;
              });
            });
            continue;
          }
          if (value.startsWith('eq.')) {
            const val = value.replace('eq.', '');
            data = data.filter(item => String(item[key]) === String(val));
          } else if (value.startsWith('gt.')) {
            const val = value.replace('gt.', '');
            data = data.filter(item => item[key] > val);
          } else if (value.startsWith('gte.')) {
            const val = value.replace('gte.', '');
            data = data.filter(item => item[key] >= val);
          } else if (value.startsWith('lt.')) {
            const val = value.replace('lt.', '');
            data = data.filter(item => item[key] < val);
          } else if (value.startsWith('lte.')) {
            const val = value.replace('lte.', '');
            data = data.filter(item => item[key] <= val);
          } else if (value.startsWith('ilike.')) {
            const val = value.replace('ilike.', '').replace(/%/g, '').toLowerCase();
            data = data.filter(item => String(item[key]).toLowerCase().includes(val));
          } else if (value.startsWith('neq.')) {
            const val = value.replace('neq.', '');
            data = data.filter(item => String(item[key]) !== String(val));
          } else if (value.startsWith('in.')) {
            const val = value.replace('in.(', '').replace(')', '').split(',');
            data = data.filter(item => val.includes(String(item[key])));
          }
        }
        
        // Handle limit
        const limitStr = urlObj.searchParams.get('limit');
        if (limitStr && limitStr !== '1') {
          data = data.slice(0, parseInt(limitStr, 10));
        }
        
        const headers: any = { 'Content-Type': 'application/json' };
        if (init?.headers && (init.headers as any)['Prefer']?.includes('count=exact')) {
          headers['Content-Range'] = `0-${data.length - 1}/${data.length}`;
        }

        if (init?.method === 'HEAD') {
          return new Response(null, { status: 200, headers });
        }

        // Handle single item request
        const acceptHeader = init?.headers instanceof Headers 
          ? init.headers.get('Accept') 
          : (init?.headers as any)?.['Accept'];
        
        if (urlObj.searchParams.get('limit') === '1' || acceptHeader === 'application/vnd.pgrst.object+json') {
          return new Response(JSON.stringify(data[0] || null), { status: 200, headers });
        }
        
        return new Response(JSON.stringify(data), { status: 200, headers });
      }

      if (init?.method === 'POST' || init?.method === 'PATCH' || init?.method === 'DELETE') {
        const urlObj = new URL(url);
        const table = urlObj.pathname.split('/').pop();
        const body = init.body ? JSON.parse(init.body as string) : {};

        if (table === 'posts' && init.method === 'POST') {
          const newPost = {
            id: `post-${Date.now()}`,
            ...body,
            likes_count: 0,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            deletado: false,
            author: MOCK_PROFILES.find(p => p.user_id === body.user_id)
          };
          MOCK_POSTS.unshift(newPost);
          return new Response(JSON.stringify([newPost]), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        if (table === 'game_state' && init.method === 'PATCH') {
          if (body.game_on !== undefined && typeof localStorage !== 'undefined') {
            localStorage.setItem('gameActive', JSON.stringify(body.game_on));
          }
          return new Response(JSON.stringify([{ id: 1, game_on: body.game_on, updated_at: new Date().toISOString() }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (table === 'duels') {
          if (init.method === 'POST') {
            const newDuel = {
              id: `duel-${Date.now()}`,
              ...body,
              status: body.status || 'pending',
              created_at: new Date().toISOString(),
              challenger: MOCK_PROFILES.find(p => p.id === body.challenger_id),
              challenged: MOCK_PROFILES.find(p => p.id === body.challenged_id),
              challenger_votes: 0,
              challenged_votes: 0
            };
            MOCK_DUELS.unshift(newDuel);
            return new Response(JSON.stringify([newDuel]), { status: 201, headers: { 'Content-Type': 'application/json' } });
          } else if (init.method === 'PATCH') {
            const id = urlObj.searchParams.get('id')?.replace('eq.', '');
            const duelIndex = MOCK_DUELS.findIndex(d => d.id === id);
            if (duelIndex !== -1) {
              MOCK_DUELS[duelIndex] = { ...MOCK_DUELS[duelIndex], ...body };
              return new Response(JSON.stringify([MOCK_DUELS[duelIndex]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
          }
        }

        if (table === 'profiles' && init.method === 'PATCH') {
          const id = urlObj.searchParams.get('user_id')?.replace('eq.', '');
          const profileIndex = MOCK_PROFILES.findIndex(p => p.user_id === id);
          if (profileIndex !== -1) {
            MOCK_PROFILES[profileIndex] = { ...MOCK_PROFILES[profileIndex], ...body };
            return new Response(JSON.stringify([MOCK_PROFILES[profileIndex]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
        }

        if (table === 'duel_votes' && init.method === 'POST') {
          const duelId = body.duel_id;
          const votedId = body.voted_id;
          const duelIndex = MOCK_DUELS.findIndex(d => d.id === duelId);
          if (duelIndex !== -1) {
            if (MOCK_DUELS[duelIndex].challenger_id === votedId) {
              MOCK_DUELS[duelIndex].challenger_votes += 10;
            } else {
              MOCK_DUELS[duelIndex].challenged_votes += 10;
            }
          }
          return new Response(JSON.stringify([body]), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        if (table === 'comment_reactions' && init.method === 'POST') {
          const commentId = body.comment_id;
          const reactionType = body.reaction_type;
          const commentIndex = MOCK_POSTS.findIndex(p => p.id === commentId); // Wait, comments are not in MOCK_POSTS
          // I'll just return success for now as comments are not in a global mock array I can easily mutate
          return new Response(JSON.stringify([body]), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }

        // Just return success for other mutations
        return new Response(JSON.stringify([{ success: true }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
  }

  return originalFetch(input, init);
};
