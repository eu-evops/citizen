const request = require('supertest');
const { expect } = require('chai');
const { promisify } = require('util');
const rimraf = promisify(require('rimraf'));
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

const app = require('../app');
const { deleteDbAll } = require('../test/helper');
const { db, save } = require('../lib/modules-store');

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

describe.skip('POST /v1/providers/:namespace/:name/:provider/:version', () => {
  let moduleBuf;
  let modulePath;
  const tarballPath = path.join(__dirname, '../test', 'fixture/test.tar.gz');

  beforeEach(async () => {
    modulePath = `hashicorp/consul/aws/${(new Date()).getTime()}`;
  });

  afterEach(async () => {
    await deleteDbAll(db);
    await rimraf(process.env.CITIZEN_STORAGE_PATH);
  });

  it('should register new module', () => request(app)
    .post(`/v1/providers/${modulePath}`)
    .attach('module', 'test/fixture/module.tar.gz')
    .expect('Content-Type', /application\/json/)
    .expect(201)
    .then((res) => {
      expect(res.body).to.have.property('providers').to.be.an('array');
      expect(res.body.providers[0]).to.have.property('id').to.equal(modulePath);
    }));

  it('should reject the request if the module is already exists.', async () => {
    const pathToStore = path.join(process.env.CITIZEN_STORAGE_PATH, `${modulePath}/test.tar.gz`);
    const parsedPath = path.parse(pathToStore);
    await mkdirp(parsedPath.dir);
    moduleBuf = await readFile(tarballPath);
    await writeFile(pathToStore, moduleBuf);

    return request(app)
      .post(`/v1/providers/${modulePath}`)
      .attach('module', 'test/fixture/test.tar.gz')
      .expect('Content-Type', /application\/json/)
      .expect(409)
      .then((res) => {
        expect(res.body).to.have.property('errors').to.be.an('array');
      });
  });

  it('should register new module with owner infomation', () => request(app)
    .post(`/v1/providers/${modulePath}`)
    .field('owner', 'outsideris')
    .attach('module', 'test/fixture/module.tar.gz')
    .expect('Content-Type', /application\/json/)
    .expect(201)
    .then((res) => {
      expect(res.body).to.have.property('providers').to.be.an('array');
      expect(res.body.providers[0]).to.have.property('id').to.equal(modulePath);
    }));

  it('should register module information', (done) => {
    request(app)
      .post(`/v1/providers/${modulePath}`)
      .attach('module', 'test/fixture/complex.tar.gz')
      .expect('Content-Type', /application\/json/)
      .expect(201)
      .then((res) => {
        db.find({
          namespace: res.body.providers[0].namespace,
          name: res.body.providers[0].name,
          provider: res.body.providers[0].provider,
          version: res.body.providers[0].version,
        }, (err, docs) => {
          if (err) { return done(err); }

          expect(docs[0]).to.have.property('root');
          expect(docs[0].root).to.have.property('name').to.equal('consul');
          expect(docs[0]).to.have.property('subproviders').to.be.an.instanceof(Array);
          expect(docs[0].subproviders).to.have.lengthOf(3);
          return done();
        });
      });
  });
});

describe.skip('GET /v1/providers/:namespace/:name/:provider/:version', () => {
  before(async () => {
    await save({
      namespace: 'router', name: 'specific', provider: 'aws', version: '1.1.2', owner: '',
    });
  });

  after(async () => {
    await deleteDbAll(db);
  });

  it('should return a specific module', () => request(app)
    .get('/v1/providers/router/specific/aws/1.1.2')
    .expect('Content-Type', /application\/json/)
    .expect(200)
    .then((res) => {
      expect(res.body).to.have.property('id').to.equal('router/specific/aws/1.1.2');
      expect(res.body).to.have.property('version').to.equal('1.1.2');
    }));

  it('should return 404 if given module does not exist', () => request(app)
    .get('/v1/providers/router/specific/aws/2.1.2')
    .expect('Content-Type', /application\/json/)
    .expect(404));
});

describe.skip('GET /v1/providers/:namespace/:name/:provider', () => {
  before(async () => {
    await save({
      namespace: 'router', name: 'latest', provider: 'aws', version: '1.1.1', owner: '', definition: { root: { name: 'latest' }, subproviders: [{ name: 'example' }] },
    });
    await save({
      namespace: 'router', name: 'latest', provider: 'aws', version: '1.1.2', owner: '', definition: { root: { name: 'latest' }, subproviders: [{ name: 'example' }] },
    });
  });

  after(async () => {
    await deleteDbAll(db);
  });

  it('should return latest version for a specific module provider', () => request(app)
    .get('/v1/providers/router/latest/aws')
    .expect('Content-Type', /application\/json/)
    .expect(200)
    .then((res) => {
      expect(res.body).to.have.property('version').to.equal('1.1.2');
      expect(res.body).to.have.property('root').to.have.property('name').to.equal('latest');
      expect(res.body.subproviders[0]).to.have.property('name').to.equal('example');
    }));

  it('should return 404 if given module does not exist', () => request(app)
    .get('/v1/providers/router/latest/nomodule')
    .expect('Content-Type', /application\/json/)
    .expect(404)
    .then((res) => {
      expect(res.body).to.have.property('errors').to.be.an('array');
    }));
});
