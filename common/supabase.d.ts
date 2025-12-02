export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "12.2.12 (cd3cf9e)";
    };
    public: {
        Tables: {
            "file-share": {
                Row: {
                    can_write: boolean;
                    file: number;
                    shared_at: string;
                    user: number;
                };
                Insert: {
                    can_write?: boolean;
                    file: number;
                    shared_at?: string;
                    user: number;
                };
                Update: {
                    can_write?: boolean;
                    file?: number;
                    shared_at?: string;
                    user?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "file-share_file_fkey";
                        columns: ["file"];
                        isOneToOne: false;
                        referencedRelation: "files";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "file-share_user_fkey";
                        columns: ["user"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    }
                ];
            };
            files: {
                Row: {
                    channel: string;
                    created_at: string | null;
                    folder: number | null;
                    has_thumbnail: boolean;
                    hash: string | null;
                    id: number;
                    is_encrypted: boolean;
                    is_public: boolean;
                    messages: string[];
                    name: string;
                    owner: number | null;
                    size: number;
                    type: string;
                    updated_at: string | null;
                };
                Insert: {
                    channel: string;
                    created_at?: string | null;
                    folder?: number | null;
                    has_thumbnail?: boolean;
                    hash?: string | null;
                    id?: number;
                    is_encrypted?: boolean;
                    is_public?: boolean;
                    messages?: string[];
                    name: string;
                    owner?: number | null;
                    size: number;
                    type?: string;
                    updated_at?: string | null;
                };
                Update: {
                    channel?: string;
                    created_at?: string | null;
                    folder?: number | null;
                    has_thumbnail?: boolean;
                    hash?: string | null;
                    id?: number;
                    is_encrypted?: boolean;
                    is_public?: boolean;
                    messages?: string[];
                    name?: string;
                    owner?: number | null;
                    size?: number;
                    type?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "files_folder_fkey";
                        columns: ["folder"];
                        isOneToOne: false;
                        referencedRelation: "folders";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "files_owner_fkey";
                        columns: ["owner"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    }
                ];
            };
            folders: {
                Row: {
                    id: number;
                    name: string;
                    parent_folder: number | null;
                };
                Insert: {
                    id?: number;
                    name: string;
                    parent_folder?: number | null;
                };
                Update: {
                    id?: number;
                    name?: string;
                    parent_folder?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "folders_parent_folder_fkey";
                        columns: ["parent_folder"];
                        isOneToOne: false;
                        referencedRelation: "folders";
                        referencedColumns: ["id"];
                    }
                ];
            };
            users: {
                Row: {
                    id: number;
                    password: string;
                    salt: string;
                    username: string;
                };
                Insert: {
                    id?: number;
                    password: string;
                    salt: string;
                    username: string;
                };
                Update: {
                    id?: number;
                    password?: string;
                    salt?: string;
                    username?: string;
                };
                Relationships: [];
            };
        };
        Views: {
            get_file_type_total_size: {
                Row: {
                    sum: number | null;
                    type: string | null;
                };
                Relationships: [];
            };
            get_folder_sizes_by_file_type: {
                Row: {
                    folder: number | null;
                    sum: number | null;
                    type: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "files_folder_fkey";
                        columns: ["folder"];
                        isOneToOne: false;
                        referencedRelation: "folders";
                        referencedColumns: ["id"];
                    }
                ];
            };
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
    DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
      ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never;

export type FileHandle = Database["public"]["Tables"]["files"]["Row"];
export type FolderHandle = Database["public"]["Tables"]["folders"]["Row"];
export type FileShareHandle = Database["public"]["Tables"]["file-share"]["Row"];
export type UserHandle = Database["public"]["Tables"]["users"]["Row"];
