export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            thumbnail_scale: "tiny" | "default" | "large";
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
    DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof Database },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never;

export type FileHandle = Database["public"]["Tables"]["files"]["Row"];
export type FolderHandle = Database["public"]["Tables"]["folders"]["Row"];
export type FileShareHandle = Database["public"]["Tables"]["file-share"]["Row"];
export type UserHandle = Database["public"]["Tables"]["users"]["Row"];
