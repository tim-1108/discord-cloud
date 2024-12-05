export interface Message {
    id: Snowflake;
    attachments: Attachment[];
}

export interface Attachment {
    id: Snowflake;
    filename: string;
    url: string;
}

type Snowflake = string;
