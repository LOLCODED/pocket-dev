use crate::error::AppResult;

const SERVICE: &str = "pocket-dev";

pub fn get(key: &str) -> AppResult<Option<String>> {
    match keyring::Entry::new(SERVICE, key)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn set(key: &str, value: &str) -> AppResult<()> {
    keyring::Entry::new(SERVICE, key)?.set_password(value)?;
    Ok(())
}

pub fn delete(key: &str) -> AppResult<()> {
    match keyring::Entry::new(SERVICE, key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}
