export type InteractionType = "like" | "love" | "bomb";

export interface PostAuthor {
  id: string;
  name: string;
  avatar_url: string | null;
  user_type: "jogador" | "juiz";
  eliminated_at?: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  music_url: string | null;
  likes_count: number;
  created_at: string;
  expires_at: string;
  author?: PostAuthor;
  additional_images?: string[];
  multiplicador?: number | null;
  tema_id?: string | null;
  coroinha?: boolean | null;
  raio?: boolean | null;
}

export interface PostInteraction {
  id: string;
  post_id: string;
  user_id: string;
  interaction_type: InteractionType;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export type FeedTab = "na-tela" | "acontecendo" | "fan-club" | "lacrou" | "bomba" | "duelos" | "cultura";
