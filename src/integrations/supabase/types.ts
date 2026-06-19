export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      jarvis_actions: {
        Row: {
          action_type: string
          id: string
          payload: Json | null
          result: string | null
          target: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          action_type: string
          id?: string
          payload?: Json | null
          result?: string | null
          target?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          action_type?: string
          id?: string
          payload?: Json | null
          result?: string | null
          target?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      jarvis_conversations: {
        Row: {
          id: string
          jarvis_response: string | null
          metadata: Json | null
          timestamp: string
          user_id: string
          user_input: string
        }
        Insert: {
          id?: string
          jarvis_response?: string | null
          metadata?: Json | null
          timestamp?: string
          user_id: string
          user_input: string
        }
        Update: {
          id?: string
          jarvis_response?: string | null
          metadata?: Json | null
          timestamp?: string
          user_id?: string
          user_input?: string
        }
        Relationships: []
      }
      jarvis_decision_history: {
        Row: {
          agent_selected: string | null
          classification: string | null
          decision_data: Json | null
          id: string
          timestamp: string
          user_id: string
          user_input: string
        }
        Insert: {
          agent_selected?: string | null
          classification?: string | null
          decision_data?: Json | null
          id?: string
          timestamp?: string
          user_id: string
          user_input: string
        }
        Update: {
          agent_selected?: string | null
          classification?: string | null
          decision_data?: Json | null
          id?: string
          timestamp?: string
          user_id?: string
          user_input?: string
        }
        Relationships: []
      }
      jarvis_goals: {
        Row: {
          created_at: string
          goal_name: string
          id: string
          priority: number | null
          progress: number | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_name: string
          id?: string
          priority?: number | null
          progress?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_name?: string
          id?: string
          priority?: number | null
          progress?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jarvis_knowledge: {
        Row: {
          category: string | null
          content: string
          id: string
          learned_from_query: boolean | null
          source: string | null
          timestamp: string
          topic: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          id?: string
          learned_from_query?: boolean | null
          source?: string | null
          timestamp?: string
          topic: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          id?: string
          learned_from_query?: boolean | null
          source?: string | null
          timestamp?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      jarvis_mistakes: {
        Row: {
          context: string | null
          correction: string | null
          id: string
          learned: boolean | null
          lesson_learned: string | null
          mistake_description: string
          timestamp: string
          user_id: string
        }
        Insert: {
          context?: string | null
          correction?: string | null
          id?: string
          learned?: boolean | null
          lesson_learned?: string | null
          mistake_description: string
          timestamp?: string
          user_id: string
        }
        Update: {
          context?: string | null
          correction?: string | null
          id?: string
          learned?: boolean | null
          lesson_learned?: string | null
          mistake_description?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      jarvis_patterns: {
        Row: {
          action_taken: string | null
          confidence: number | null
          discovered_at: string
          frequency: number | null
          id: string
          pattern_name: string
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          confidence?: number | null
          discovered_at?: string
          frequency?: number | null
          id?: string
          pattern_name: string
          user_id: string
        }
        Update: {
          action_taken?: string | null
          confidence?: number | null
          discovered_at?: string
          frequency?: number | null
          id?: string
          pattern_name?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge: {
        Row: {
          content: string
          created_at: string
          id: string
          source: string | null
          topic: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          source?: string | null
          topic: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          source?: string | null
          topic?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
