var exec = require('child_process').exec;

module.exports = pushDir;

function pushDir(opts) {
  getLastCommitInfo().then(function(info) {
    var hash = info.hash;
    var originalBranch = info.branch;

    var directory = opts.dir;
    var local = opts.branch + '-' + hash;
    var remote = opts.remote || 'origin';
    var remoteBranch = opts.branch;
    var message = typeof opts.message === 'function' ?
      opts.message(hash) : opts.message || hash;
    var allowUnclean = opts['allow-unclean'] || opts.force;
    var overwriteLocal = opts['overwrite-local'] || opts.force;
    var cleanup = opts.cleanup === undefined ? false : opts.cleanup;

    Promise.resolve()
      .then(checkIfClean)
      .catch(function onUnclean(reason) {
        return allowUnclean ?
          console.log('ignoring unclean git...') : Promise.reject(reason);
      })

      .then(noLocalBranchConflict.bind(null, local))
      .catch(function onBranchConflict(reason) {
        return overwriteLocal ?
          overwriteLocalBranch(local) : Promise.reject(reason);
      })

      .then(checkoutOrphanBranch.bind(null, directory, local))
      .then(addDir.bind(null, directory))
      .then(commitDir.bind(null, directory, message))
      .then(pushDirToRemote.bind(null, remote, remoteBranch))
      .then(resetBranch.bind(null, originalBranch))
      .then(cleanup ? deleteLocalBranch.bind(null, local) : null)
      .catch(handleError);

  }, handleError);
}

/**
 * Tasks
 */

function overwriteLocalBranch(local) {
  console.log('will overwite local branch...');
  return deleteLocalBranch(local);
}

function checkIfClean() {
  return expectOutputEmpty(
    'git status --porcelain',
    'git not clean'
  );
}

function getCurrentBranch() {
  return execCmd(
    'git rev-parse --abbrev-ref HEAD',
    'problem getting current branch'
  );
}

function resetBranch(branch) {
  return execCmd(
    'git checkout -f ' + branch,
    'problem resetting branch'
  );
}

function addDir(directory) {
  return execCmd(
    'git --work-tree ' + directory + ' add --all',
    'problem adding directory to local branch'
  );
}

function commitDir(directory, message) {
  return execCmd(
    'git --work-tree ' + directory + ' commit -m "' + message + '"',
    'problem committing directory to local branch'
  );
}

function pushDirToRemote(remote, remoteBranch) {
  return execCmd(
    'git push ' + remote + ' HEAD:' + remoteBranch + ' --force',
    'problem pushing local branch to remote'
  );
}

function checkoutOrphanBranch(directory, branch) {
  return execCmd(
    'git --work-tree ' + directory + ' checkout --orphan ' + branch,
    'problem creating local orphan branch'
  );
}

function deleteLocalBranch(branch) {
  return execCmd(
    'git branch -D ' + branch,
    'problem deleting local branch'
  );
}

function noLocalBranchConflict(branch) {
  return expectOutputEmpty(
    'git branch --list ' + branch,
    'local branch with name already exists'
  );
}

function getLastCommitInfo() {
  return Promise
    .all([
      getLastCommitHash(),
      getCurrentBranch()
    ])
    .then(function(info) {
      return {
        hash: info[0].trim(),
        branch: info[1].trim()
      };
    });
}

function getLastCommitHash() {
  return execCmd(
    'git rev-parse --short HEAD',
    'problem getting last commit hash'
  );
}


/**
 * Helpers
 */

function handleError(err) {
  console.error('aborted:', err);
  process.exit(1);
}

function execCmd(cmd, errMessage) {
  return new Promise(function(resolve, reject) {
    exec(cmd, function (error, stdout, stderr) {
      error ? reject(errMessage) : resolve(stdout);
    });
  });
}

function expectOutputEmpty(cmd, errMessage) {
  return new Promise(function(resolve, reject) {
    exec(cmd, function (error, stdout, stderr) {
      (error || stdout.length || stderr.length) ? reject(errMessage) : resolve();
    });
  });
}
