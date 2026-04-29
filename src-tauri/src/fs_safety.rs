use std::path::{Component, Path, PathBuf};

use crate::error::{AppError, AppResult};

/// Resolve a user-supplied path against the project root, rejecting any
/// attempt to escape it. Works for paths whose target may not yet exist
/// (e.g. a file we are about to create) by canonicalising the parent.
pub fn resolve_safe_path(project_root: &Path, user_path: &str) -> AppResult<PathBuf> {
    let candidate = Path::new(user_path);

    // Reject any explicit parent traversal up front - defense in depth.
    if candidate
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
        return Err(AppError::PathOutsideProject);
    }

    // Reject absolute paths; everything must be relative to the project.
    if candidate.is_absolute() {
        return Err(AppError::PathOutsideProject);
    }

    let root = project_root
        .canonicalize()
        .map_err(|_| AppError::NoProjectOpen)?;
    let joined = root.join(candidate);

    let canonical = if joined.exists() {
        joined.canonicalize()?
    } else {
        let parent = joined
            .parent()
            .ok_or(AppError::PathOutsideProject)?
            .canonicalize()?;
        let file_name = joined
            .file_name()
            .ok_or_else(|| AppError::InvalidInput("empty path".into()))?;
        parent.join(file_name)
    };

    if !canonical.starts_with(&root) {
        return Err(AppError::PathOutsideProject);
    }

    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn rejects_dotdot() {
        let tmp = tempdir("dotdot");
        let res = resolve_safe_path(&tmp, "../etc/passwd");
        assert!(matches!(res, Err(AppError::PathOutsideProject)));
    }

    #[test]
    fn rejects_absolute() {
        let tmp = tempdir("absolute");
        let res = resolve_safe_path(&tmp, "/etc/passwd");
        assert!(matches!(res, Err(AppError::PathOutsideProject)));
    }

    #[test]
    fn allows_relative_existing() {
        let tmp = tempdir("existing");
        fs::write(tmp.join("hello.txt"), "hi").unwrap();
        let res = resolve_safe_path(&tmp, "hello.txt").unwrap();
        assert!(res.ends_with("hello.txt"));
    }

    #[test]
    fn allows_new_file_in_existing_dir() {
        let tmp = tempdir("new-file");
        let res = resolve_safe_path(&tmp, "new.txt").unwrap();
        assert!(res.ends_with("new.txt"));
    }

    fn tempdir(tag: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "pocketdev-test-{}-{}",
            std::process::id(),
            tag
        ));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }
}
