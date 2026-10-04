---
title: Maven / Gradle
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: Maven 3.9 · Gradle 8.10
tags: [java, build, jvm]
sources: [maven.apache.org/guides, docs.gradle.org/8.10]
---

Build commands, dependency management and the internal mirror set-up for both tools.

## Maven lifecycle

- Phases run in order: `validate → compile → test → package → verify → install → deploy`
- `clean` deletes `target/`
- `-pl` / `-am` build selected modules in a multi-module project

```bash
mvn clean verify
mvn -DskipTests package
mvn -pl loan-service -am install
mvn -q -Dtest=EmiCalculatorTest test
```

## Gradle tasks

- Always use the wrapper (`./gradlew`) so everyone uses the same version
- `build` = compile + test + assemble
- `--scan` is disabled internally; use `--info` / `--stacktrace` to debug

```bash
./gradlew clean build
./gradlew test --tests "*EmiCalculatorTest"
./gradlew :loan-service:bootJar
./gradlew tasks --all
```

## Dependencies (Maven)

- Manage versions centrally with a BOM in `dependencyManagement`
- `test` scope for test libraries; `provided` for container-supplied APIs
- Exclude unwanted transitive dependencies

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-dependencies</artifactId>
      <version>3.3.4</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
```

## Dependencies (Gradle)

- `implementation` hides the dependency from consumers; `api` exposes it
- Use a version catalog (`gradle/libs.versions.toml`) for shared versions
- `platform()` imports a BOM

```groovy
dependencies {
    implementation platform('org.springframework.boot:spring-boot-dependencies:3.3.4')
    implementation 'org.springframework.boot:spring-boot-starter-web'
    testImplementation 'org.junit.jupiter:junit-jupiter'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

tasks.named('test') { useJUnitPlatform() }
```

## Inspect the dependency tree

- Find where a vulnerable transitive library comes from
- Maven: `dependency:tree` with `-Dincludes`
- Gradle: `dependencyInsight`

```bash
mvn dependency:tree -Dincludes=com.fasterxml.jackson.core
mvn versions:display-dependency-updates
./gradlew dependencies --configuration runtimeClasspath
./gradlew dependencyInsight --dependency jackson-databind
```

## Internal mirror (Maven)

- Route every download through Nexus/Artifactory (NFR-8)
- Put credentials in `~/.m2/settings.xml`, never in the POM
- `mirrorOf *` catches all repositories

```xml
<settings>
  <mirrors>
    <mirror>
      <id>internal</id>
      <mirrorOf>*</mirrorOf>
      <url>https://nexus.internal/repository/maven-public/</url>
    </mirror>
  </mirrors>
</settings>
```

## Internal mirror (Gradle)

- Configure repositories centrally in `settings.gradle`
- `FAIL_ON_PROJECT_REPOS` stops modules adding their own repositories
- Keep credentials in `~/.gradle/gradle.properties`

```groovy
dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        maven {
            url 'https://nexus.internal/repository/maven-public/'
            credentials(PasswordCredentials) { name = 'nexus' }
        }
    }
}
```

## Useful flags

- `-o` / `--offline` builds from the local cache only
- `-U` (Maven) forces snapshot updates; `--refresh-dependencies` (Gradle)
- `-T 1C` / `--parallel` speeds up multi-module builds

```bash
mvn -o -T 1C verify
mvn -U clean install
./gradlew build --offline --parallel
./gradlew build --refresh-dependencies
```
