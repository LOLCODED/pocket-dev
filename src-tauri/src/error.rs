use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("path is outside the active project")]
    PathOutsideProject,
    #[error("no project is open")]
    NoProjectOpen,
    #[error("file not found: {0}")]
    FileNotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("not connected to a database")]
    NotConnected,
    #[error("database error: {0}")]
    Db(String),
    #[error("language model error: {0}")]
    Llm(String),
    #[error("keychain error: {0}")]
    Keychain(String),
    #[error("config error: {0}")]
    Config(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl AppError {
    pub fn kind(&self) -> &'static str {
        match self {
            AppError::PathOutsideProject => "path_outside_project",
            AppError::NoProjectOpen => "no_project_open",
            AppError::FileNotFound(_) => "file_not_found",
            AppError::Io(_) => "io",
            AppError::NotConnected => "not_connected",
            AppError::Db(_) => "db",
            AppError::Llm(_) => "llm",
            AppError::Keychain(_) => "keychain",
            AppError::Config(_) => "config",
            AppError::InvalidInput(_) => "invalid_input",
            AppError::Internal(_) => "internal",
        }
    }

    pub fn retriable(&self) -> bool {
        matches!(self, AppError::Llm(_) | AppError::Db(_) | AppError::Io(_))
    }
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = s.serialize_struct("AppError", 3)?;
        st.serialize_field("kind", self.kind())?;
        st.serialize_field("message", &self.to_string())?;
        st.serialize_field("retriable", &self.retriable())?;
        st.end()
    }
}

impl From<keyring::Error> for AppError {
    fn from(e: keyring::Error) -> Self {
        AppError::Keychain(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Config(e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
