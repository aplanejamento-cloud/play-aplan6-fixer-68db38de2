export const MOCK_USERS = [
  { id: 'admin-id', email: 'aplanejamento@gmail.com', name: 'Admin Planejamento', user_type: 'admin', total_likes: 2000, avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin' },
  { id: '2', email: 'teste1@gmail.com', name: 'Jogador Teste 1', user_type: 'jogador', total_likes: 1010, avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=teste1' },
  { id: '3', email: 'teste2@gmail.com', name: 'Jogador Teste 2', user_type: 'jogador', total_likes: 790, avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=teste2' },
  { id: '4', email: 'juiz@gmail.com', name: 'Juiz Principal', user_type: 'juiz', total_likes: 5000, avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=juiz' }
];

export const MOCK_PROFILES = MOCK_USERS.map(u => ({
  id: u.id,
  user_id: u.id,
  name: u.name,
  email: u.email,
  user_type: u.user_type,
  total_likes: u.total_likes,
  avatar_url: u.avatar_url,
  bio: 'Mock profile bio',
  created_at: new Date().toISOString()
}));

export const MOCK_POSTS = Array.from({ length: 20 }).map((_, i) => ({
  id: `post-${i}`,
  user_id: MOCK_USERS[i % 4].id,
  content: `Este é o post mockado número ${i + 1} para testar o feed! 🚀`,
  image_url: `https://picsum.photos/seed/post${i}/600/400`,
  tipo: i % 5 === 0 ? 'cultural' : 'comum',
  likes_count: Math.floor(Math.random() * 500),
  created_at: new Date(Date.now() - i * 3600000).toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  deletado: false,
  author: MOCK_PROFILES[i % 4]
}));

export const MOCK_DUELS = [
  {
    id: 'duel-1',
    challenger_id: '2',
    challenged_id: '3',
    status: 'pending',
    created_at: new Date().toISOString(),
    challenger: MOCK_PROFILES[1],
    challenged: MOCK_PROFILES[2],
    challenger_votes: 0,
    challenged_votes: 0
  },
  {
    id: 'duel-2',
    challenger_id: '3',
    challenged_id: '2',
    status: 'pending',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    challenger: MOCK_PROFILES[2],
    challenged: MOCK_PROFILES[1],
    challenger_votes: 0,
    challenged_votes: 0
  },
  {
    id: 'duel-3',
    challenger_id: '2',
    challenged_id: '4',
    status: 'pending',
    created_at: new Date().toISOString(),
    challenger: MOCK_PROFILES[1],
    challenged: MOCK_PROFILES[3],
    challenger_votes: 0,
    challenged_votes: 0
  }
];

export const MOCK_CHATS = [
  {
    id: 'chat-1',
    juiz_id: '1',
    jogador_id: '2',
    ativa: true,
    data_inicio: new Date().toISOString(),
    data_fim: new Date(Date.now() + 86400000).toISOString(),
    juiz_profile: MOCK_PROFILES[0],
    jogador_profile: MOCK_PROFILES[1]
  }
];

export const MOCK_MESSAGES = Array.from({ length: 50 }).map((_, i) => ({
  id: `msg-${i}`,
  chat_id: 'chat-1',
  sender_id: i % 2 === 0 ? '1' : '2',
  content: `Mensagem mockada ${i + 1} no chat!`,
  created_at: new Date(Date.now() - (50 - i) * 60000).toISOString()
}));
